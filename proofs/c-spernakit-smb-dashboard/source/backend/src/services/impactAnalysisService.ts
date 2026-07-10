import type {
	AssetRelationshipType,
	AssetStatus,
	AssetType,
	CriticalityLevel,
} from 'spernakit-shared';

import { and, eq } from 'drizzle-orm';

import type { DependencyEdge, ImpactAsset, ImpactNode } from './impactGraph.ts';

import { getDb } from '../db/index.ts';
import { assetRelationships } from '../db/schema/assetRelationships.ts';
import { assets } from '../db/schema/assets.ts';
import { buildAdjacency, maxDepth, PROVIDER_ENDPOINT, traverse } from './impactGraph.ts';

/**
 * Upper bound on how many assets a single impact traversal will resolve, guarding
 * the in-memory graph against a pathological inventory. Well above any realistic
 * SMB asset count; if exceeded the traversal still runs against the loaded subset.
 */
const MAX_ASSETS = 20_000;

/** The full result of an impact analysis for one asset. */
interface ImpactAnalysis {
	/** Downstream business services impacted if the root goes offline (subset of downstream). */
	affectedServices: ImpactNode[];
	/** Assets that would be impacted if the root asset went offline. */
	downstream: ImpactNode[];
	/** The asset the analysis is rooted at, or null when it does not exist. */
	root: ImpactAsset | null;
	summary: {
		affectedServiceCount: number;
		downstreamCount: number;
		maxDownstreamDepth: number;
		maxUpstreamDepth: number;
		upstreamCount: number;
	};
	/** Assets the root asset depends on (its outage would impact the root). */
	upstream: ImpactNode[];
}

/** The minimal asset columns the impact graph needs. */
const IMPACT_ASSET_COLUMNS = {
	assetType: assets.assetType,
	criticality: assets.criticality,
	id: assets.id,
	name: assets.name,
	status: assets.status,
} as const;

/**
 * Narrow a raw asset row's enum-backed text columns to their literal union types.
 *
 * @param row - The raw asset row with text-typed enum columns
 * @param row.assetType - The asset's type, cast to {@link AssetType}
 * @param row.criticality - The asset's criticality, cast to {@link CriticalityLevel}
 * @param row.id - The asset id
 * @param row.name - The asset display name
 * @param row.status - The asset's lifecycle status, cast to {@link AssetStatus}
 * @returns The row with enum columns cast to their domain literal unions
 */
function toImpactAsset(row: {
	assetType: string;
	criticality: string;
	id: number;
	name: string;
	status: string;
}): ImpactAsset {
	return {
		assetType: row.assetType as AssetType,
		criticality: row.criticality as CriticalityLevel,
		id: row.id,
		name: row.name,
		status: row.status as AssetStatus,
	};
}

/**
 * Fetch the root asset's minimal identity, or null when it does not exist or is
 * soft-deleted (impact of a decommissioned asset is not meaningful).
 *
 * @param assetId - The asset to root the analysis at
 * @returns The asset's minimal identity, or null when missing / soft-deleted
 */
function loadRootAsset(assetId: number): ImpactAsset | null {
	const db = getDb();
	const row = db
		.select(IMPACT_ASSET_COLUMNS)
		.from(assets)
		.where(and(eq(assets.id, assetId), eq(assets.isDeleted, false)))
		.get();
	return row ? toImpactAsset(row) : null;
}

/**
 * Load all active assets' minimal identity into a lookup keyed by id.
 *
 * @returns A map from asset id to its minimal identity
 */
function loadAssetIndex(): Map<number, ImpactAsset> {
	const db = getDb();
	const rows = db
		.select(IMPACT_ASSET_COLUMNS)
		.from(assets)
		.where(eq(assets.isDeleted, false))
		.limit(MAX_ASSETS)
		.all();
	return new Map(rows.map((row) => [row.id, toImpactAsset(row)]));
}

/**
 * Load every active relationship and reduce it to a directed dependency edge,
 * dropping edges whose type is not a runtime dependency or whose endpoints are
 * not both active assets.
 *
 * @param assetIndex - Lookup of active assets, used to drop edges to inactive endpoints
 * @returns The directed dependency edges of the active graph
 */
function loadDependencyEdges(assetIndex: Map<number, ImpactAsset>): DependencyEdge[] {
	const db = getDb();
	const rows = db
		.select({
			relationshipType: assetRelationships.relationshipType,
			sourceAssetId: assetRelationships.sourceAssetId,
			targetAssetId: assetRelationships.targetAssetId,
		})
		.from(assetRelationships)
		.where(eq(assetRelationships.isDeleted, false))
		.all();

	const edges: DependencyEdge[] = [];
	for (const row of rows) {
		const type = row.relationshipType as AssetRelationshipType;
		const providerEndpoint = PROVIDER_ENDPOINT[type];
		if (!providerEndpoint) continue;
		if (!assetIndex.has(row.sourceAssetId) || !assetIndex.has(row.targetAssetId)) continue;
		const provider = providerEndpoint === 'source' ? row.sourceAssetId : row.targetAssetId;
		const dependent = providerEndpoint === 'source' ? row.targetAssetId : row.sourceAssetId;
		edges.push({ dependent, provider, relationshipType: type });
	}
	return edges;
}

/**
 * Compute the upstream (depends-on) and downstream (impact-if-offline) reach of an
 * asset across the active relationship graph, plus the downstream business
 * services affected. Answers "what breaks if this asset goes offline?".
 *
 * @param assetId - The asset to root the analysis at
 * @returns The impact analysis; `root` is null when the asset does not exist
 */
function analyzeImpact(assetId: number): ImpactAnalysis {
	const root = loadRootAsset(assetId);
	if (!root) {
		return {
			affectedServices: [],
			downstream: [],
			root: null,
			summary: {
				affectedServiceCount: 0,
				downstreamCount: 0,
				maxDownstreamDepth: 0,
				maxUpstreamDepth: 0,
				upstreamCount: 0,
			},
			upstream: [],
		};
	}

	const assetIndex = loadAssetIndex();
	const edges = loadDependencyEdges(assetIndex);

	const downstream = traverse(assetId, buildAdjacency(edges, 'provider'), assetIndex);
	const upstream = traverse(assetId, buildAdjacency(edges, 'dependent'), assetIndex);
	const affectedServices = downstream.filter((node) => node.assetType === 'business_service');

	return {
		affectedServices,
		downstream,
		root,
		summary: {
			affectedServiceCount: affectedServices.length,
			downstreamCount: downstream.length,
			maxDownstreamDepth: maxDepth(downstream),
			maxUpstreamDepth: maxDepth(upstream),
			upstreamCount: upstream.length,
		},
		upstream,
	};
}

export type { ImpactAnalysis, ImpactAsset, ImpactNode };
export { analyzeImpact };

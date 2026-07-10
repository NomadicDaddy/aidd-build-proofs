import type { AssetStatus, AssetType, CriticalityLevel } from 'spernakit-shared';

import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import type { PaginatedResponse } from '../../utils/dbHelpers.ts';
import type {
	EnrichedRelationshipRow,
	ListRelationshipsOptions,
	RelationshipRow,
} from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetRelationships } from '../../db/schema/assetRelationships.ts';
import { assets } from '../../db/schema/assets.ts';
import { paginatedQuery } from '../../utils/dbHelpers.ts';

/**
 * List relationships with pagination and filtering. When `assetId` is given,
 * edges where the asset is either endpoint are returned.
 *
 * @param options - Pagination and filter options
 * @returns Paginated relationship rows, newest first
 */
function listRelationships(options: ListRelationshipsOptions): PaginatedResponse<RelationshipRow> {
	const db = getDb();
	const conditions = [];

	if (!options.includeDeleted) {
		conditions.push(eq(assetRelationships.isDeleted, false));
	}
	if (options.workspaceScope !== undefined && options.workspaceScope !== null) {
		conditions.push(eq(assetRelationships.workspaceId, options.workspaceScope));
	}
	if (options.assetId !== undefined) {
		conditions.push(
			or(
				eq(assetRelationships.sourceAssetId, options.assetId),
				eq(assetRelationships.targetAssetId, options.assetId)
			)!
		);
	}
	if (options.sourceAssetId !== undefined) {
		conditions.push(eq(assetRelationships.sourceAssetId, options.sourceAssetId));
	}
	if (options.targetAssetId !== undefined) {
		conditions.push(eq(assetRelationships.targetAssetId, options.targetAssetId));
	}
	if (options.relationshipType) {
		conditions.push(eq(assetRelationships.relationshipType, options.relationshipType));
	}
	if (options.confidence) {
		conditions.push(eq(assetRelationships.confidence, options.confidence));
	}

	// Asset-attribute filters (status, criticality, owner, site, free-text) match
	// edges where *either* endpoint asset satisfies the criteria. Resolved through
	// a subquery of matching asset ids so a single edge with one qualifying end
	// still surfaces.
	const assetConditions = [];
	if (options.status) {
		assetConditions.push(eq(assets.status, options.status as AssetStatus));
	}
	if (options.criticality) {
		assetConditions.push(eq(assets.criticality, options.criticality as CriticalityLevel));
	}
	if (options.siteId !== undefined) {
		assetConditions.push(eq(assets.siteId, options.siteId));
	}
	if (options.ownerId !== undefined) {
		assetConditions.push(
			or(
				eq(assets.businessOwnerId, options.ownerId),
				eq(assets.technicalOwnerId, options.ownerId)
			)!
		);
	}
	if (options.search) {
		const term = `%${options.search}%`;
		assetConditions.push(
			or(
				like(assets.name, term),
				like(assets.hostname, term),
				like(assets.fqdn, term),
				like(assets.primaryIp, term)
			)!
		);
	}
	if (assetConditions.length > 0) {
		const matchingAssetIds = db
			.select({ id: assets.id })
			.from(assets)
			.where(and(...assetConditions));
		conditions.push(
			or(
				inArray(assetRelationships.sourceAssetId, matchingAssetIds),
				inArray(assetRelationships.targetAssetId, matchingAssetIds)
			)!
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return paginatedQuery(
		options.page,
		options.limit,
		(limit, offset) =>
			db
				.select()
				.from(assetRelationships)
				.where(where)
				.orderBy(desc(assetRelationships.createdAt))
				.limit(limit)
				.offset(offset)
				.all(),
		() => db.select({ count: count() }).from(assetRelationships).where(where).get()
	);
}

/**
 * Resolve the source/target endpoint names and types for a page of relationship
 * rows in a single lookup, returning enriched copies. Soft-deleted assets are
 * still resolved so their names remain visible on historical edges.
 *
 * @param rows - The relationship rows to enrich
 * @returns The rows with endpoint name/type fields attached
 */
function enrichRelationshipRows(rows: RelationshipRow[]): EnrichedRelationshipRow[] {
	if (rows.length === 0) {
		return [];
	}
	const db = getDb();
	const ids = [...new Set(rows.flatMap((r) => [r.sourceAssetId, r.targetAssetId]))];
	const assetRows = db
		.select({ assetType: assets.assetType, id: assets.id, name: assets.name })
		.from(assets)
		.where(inArray(assets.id, ids))
		.all();
	const byId = new Map(assetRows.map((a) => [a.id, a]));
	return rows.map((row) => {
		const source = byId.get(row.sourceAssetId);
		const target = byId.get(row.targetAssetId);
		return {
			...row,
			sourceAssetName: source?.name ?? null,
			sourceAssetType: (source?.assetType as AssetType | undefined) ?? null,
			targetAssetName: target?.name ?? null,
			targetAssetType: (target?.assetType as AssetType | undefined) ?? null,
		};
	});
}

/**
 * List relationships with the endpoint assets resolved to display names/types.
 * Same filtering/pagination contract as {@link listRelationships}; used by the
 * table/list view so every graph edge has a readable, filterable row.
 *
 * @param options - Pagination and filter options
 * @returns Paginated enriched relationship rows, newest first
 */
function listRelationshipsEnriched(
	options: ListRelationshipsOptions
): PaginatedResponse<EnrichedRelationshipRow> {
	const page = listRelationships(options);
	return { ...page, data: enrichRelationshipRows(page.data) };
}

export { enrichRelationshipRows, listRelationships, listRelationshipsEnriched };

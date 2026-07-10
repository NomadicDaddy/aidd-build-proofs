import type {
	AssetRelationshipType,
	AssetStatus,
	AssetType,
	CriticalityLevel,
} from 'spernakit-shared';

import type { DataResponse } from './types';

import { apiClient } from './client';

/** A minimal asset identity carried through the impact graph. */
interface ImpactAsset {
	assetType: AssetType;
	criticality: CriticalityLevel;
	id: number;
	name: string;
	status: AssetStatus;
}

/** One asset reached during traversal, annotated with how it was reached. */
interface ImpactNode extends ImpactAsset {
	depth: number;
	relationshipType: AssetRelationshipType;
	viaAssetId: number;
}

/** Summary counts for an impact analysis. */
interface ImpactSummary {
	affectedServiceCount: number;
	downstreamCount: number;
	maxDownstreamDepth: number;
	maxUpstreamDepth: number;
	upstreamCount: number;
}

/** The full result of an impact analysis for one asset. */
interface ImpactAnalysis {
	affectedServices: ImpactNode[];
	downstream: ImpactNode[];
	root: ImpactAsset | null;
	summary: ImpactSummary;
	upstream: ImpactNode[];
}

/**
 * Fetch the upstream/downstream dependency impact of an asset. Requires VIEWER
 * role or higher. Returns a 404 when the asset does not exist.
 */
function getAssetImpact(assetId: number): Promise<DataResponse<ImpactAnalysis>> {
	return apiClient.get<DataResponse<ImpactAnalysis>>(`/relationships/impact/${assetId}`);
}

export { getAssetImpact };
export type { ImpactAnalysis, ImpactAsset, ImpactNode, ImpactSummary };

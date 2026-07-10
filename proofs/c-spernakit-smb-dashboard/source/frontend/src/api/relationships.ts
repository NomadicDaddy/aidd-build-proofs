import type {
	AssetRelationshipType,
	AssetType,
	RelationshipConfidenceLevel,
} from 'spernakit-shared';

import type { PaginatedResponse } from './types';

import { apiClient } from './client';

/**
 * A directed relationship edge between two assets, with each endpoint resolved
 * to a display name/type by the list API. Mirrors the backend
 * `asset_relationships` row plus the enrichment fields.
 */
interface Relationship {
	confidence: RelationshipConfidenceLevel;
	createdAt: string;
	createdBy: null | number;
	id: number;
	isDeleted: boolean;
	notes: null | string;
	relationshipType: AssetRelationshipType;
	sourceAssetId: number;
	sourceAssetName: null | string;
	sourceAssetType: AssetType | null;
	targetAssetId: number;
	targetAssetName: null | string;
	targetAssetType: AssetType | null;
	updatedAt: string;
}

/**
 * Fetch a paginated, filterable list of asset relationships. Requires VIEWER
 * role or higher. Empty-string filter values should be omitted by the caller.
 */
function listRelationships(
	params?: Record<string, string>
): Promise<PaginatedResponse<Relationship>> {
	return apiClient.get<PaginatedResponse<Relationship>>(
		'/relationships',
		params ? { params } : undefined
	);
}

export { listRelationships };
export type { Relationship };

import type { AssetType } from 'spernakit-shared';

import type { assetRelationships } from '../../db/schema/assetRelationships.ts';

type RelationshipRow = typeof assetRelationships.$inferSelect;

/** Fields a client may set when creating a relationship. */
interface CreateRelationshipInput {
	allowUnusual?: boolean;
	confidence?: string;
	notes?: null | string;
	relationshipType: string;
	sourceAssetId: number;
	targetAssetId: number;
}

/** Fields a client may change on an existing relationship. */
interface UpdateRelationshipInput {
	allowUnusual?: boolean;
	confidence?: string;
	notes?: null | string;
	relationshipType?: string;
}

interface ListRelationshipsOptions {
	assetId?: number | undefined;
	confidence?: string | undefined;
	criticality?: string | undefined;
	includeDeleted?: boolean | undefined;
	limit: number;
	ownerId?: number | undefined;
	page: number;
	relationshipType?: string | undefined;
	search?: string | undefined;
	siteId?: number | undefined;
	sourceAssetId?: number | undefined;
	status?: string | undefined;
	targetAssetId?: number | undefined;
	/**
	 * Workspace scope filter. When set, only relationships in this workspace are
	 * returned. Null/undefined leaves the query unscoped (single-inventory or
	 * SYSOP bypass).
	 */
	workspaceScope?: null | number | undefined;
}

/**
 * A relationship row with its two endpoint assets resolved to display names and
 * types, so the table/list view can render "source →(type) target" without a
 * second round-trip. Endpoint fields are null only if the referenced asset row
 * is missing (should not happen — FK cascades delete edges with their assets).
 */
type EnrichedRelationshipRow = RelationshipRow & {
	sourceAssetName: null | string;
	sourceAssetType: AssetType | null;
	targetAssetName: null | string;
	targetAssetType: AssetType | null;
};

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type RelationshipResult =
	| { error: 'conflict' | 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: RelationshipRow };

export type {
	CreateRelationshipInput,
	EnrichedRelationshipRow,
	ListRelationshipsOptions,
	RelationshipResult,
	RelationshipRow,
	UpdateRelationshipInput,
};

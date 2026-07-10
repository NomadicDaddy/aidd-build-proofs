import { and, eq } from 'drizzle-orm';

import type { RelationshipRow } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { assetRelationships } from '../../db/schema/assetRelationships.ts';
import { assets } from '../../db/schema/assets.ts';

/**
 * Append a relationship write to the asset_change_events audit trail. Anchored
 * to the source asset so the change surfaces in that asset's history. Mirrors
 * the asset service's fire-and-forget recording contract.
 *
 * @param action - The change action (create, update, delete, restore)
 * @param row - The relationship row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordRelationshipEvent(
	action: string,
	row: RelationshipRow,
	actorId: number,
	summary: string,
	changes?: Record<string, unknown>
): void {
	const db = getDb();
	db.insert(assetChangeEvents)
		.values({
			action,
			actorId,
			assetId: row.sourceAssetId,
			...(changes !== undefined ? { changes } : {}),
			entityId: row.id,
			entityType: 'asset_relationship',
			summary,
		})
		.run();
}

/**
 * Fetch an active asset's type, or null when it does not exist / is deleted.
 *
 * @param id - Asset id
 * @returns The asset's type string, or null when missing / soft-deleted
 */
function activeAssetType(id: number): null | string {
	const db = getDb();
	const row = db
		.select({ assetType: assets.assetType })
		.from(assets)
		.where(and(eq(assets.id, id), eq(assets.isDeleted, false)))
		.get();
	return row?.assetType ?? null;
}

/**
 * Find an active duplicate edge (same source, target, type), excluding one id.
 *
 * @param sourceAssetId - Source endpoint asset id
 * @param targetAssetId - Target endpoint asset id
 * @param relationshipType - The directed relationship type
 * @param excludeId - Relationship id to ignore (used when updating an edge)
 * @returns The conflicting active row, or undefined when none exists
 */
function findDuplicate(
	sourceAssetId: number,
	targetAssetId: number,
	relationshipType: string,
	excludeId?: number
): RelationshipRow | undefined {
	const db = getDb();
	const row = db
		.select()
		.from(assetRelationships)
		.where(
			and(
				eq(assetRelationships.sourceAssetId, sourceAssetId),
				eq(assetRelationships.targetAssetId, targetAssetId),
				eq(assetRelationships.relationshipType, relationshipType),
				eq(assetRelationships.isDeleted, false)
			)
		)
		.get();
	if (row && excludeId !== undefined && row.id === excludeId) {
		return undefined;
	}
	return row;
}

/**
 * Get a single relationship by id.
 *
 * @param id - Relationship id
 * @param includeDeleted - When true, soft-deleted rows are returned too
 * @param workspaceScope - When set, the relationship must belong to this
 *   workspace or null is returned; enforces workspace boundaries on reads
 * @returns The relationship row, or null if not found
 */
function getRelationshipById(
	id: number,
	includeDeleted = false,
	workspaceScope: null | number = null
): null | RelationshipRow {
	const db = getDb();
	const conditions = [eq(assetRelationships.id, id)];
	if (!includeDeleted) {
		conditions.push(eq(assetRelationships.isDeleted, false));
	}
	if (workspaceScope !== null) {
		conditions.push(eq(assetRelationships.workspaceId, workspaceScope));
	}
	return (
		db
			.select()
			.from(assetRelationships)
			.where(and(...conditions))
			.get() ?? null
	);
}

export { activeAssetType, findDuplicate, getRelationshipById, recordRelationshipEvent };

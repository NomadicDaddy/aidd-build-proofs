import { eq, sql } from 'drizzle-orm';

import type {
	CreateRelationshipInput,
	EnrichedRelationshipRow,
	ListRelationshipsOptions,
	RelationshipResult,
	RelationshipRow,
	UpdateRelationshipInput,
} from './relationshipQueries.ts';

import { getDb } from '../db/index.ts';
import { assetRelationships } from '../db/schema/assetRelationships.ts';
import {
	activeAssetType,
	findDuplicate,
	getRelationshipById,
	listRelationships,
	listRelationshipsEnriched,
	recordRelationshipEvent,
} from './relationshipQueries.ts';
import { checkRelationshipPlausibility } from './relationshipValidation.ts';

/**
 * Create a relationship after validating endpoints, self-reference, semantic
 * plausibility, and duplicates. Records a `create` change event.
 *
 * @param input - Relationship fields (source, target, type required)
 * @param actorId - Id of the user performing the action
 * @param workspaceId - Optional workspace scope
 * @returns A discriminated result the route maps to an HTTP status
 */
function createRelationship(
	input: CreateRelationshipInput,
	actorId: number,
	workspaceId?: null | number
): RelationshipResult {
	if (input.sourceAssetId === input.targetAssetId) {
		return {
			error: 'validation',
			message: 'A relationship must connect two different assets.',
			ok: false,
		};
	}

	const sourceType = activeAssetType(input.sourceAssetId);
	if (!sourceType) {
		return { error: 'not_found', message: 'Source asset', ok: false };
	}
	const targetType = activeAssetType(input.targetAssetId);
	if (!targetType) {
		return { error: 'not_found', message: 'Target asset', ok: false };
	}

	if (!input.allowUnusual) {
		const problem = checkRelationshipPlausibility(
			input.relationshipType,
			sourceType,
			targetType
		);
		if (problem) {
			return { error: 'validation', message: problem, ok: false };
		}
	}

	if (findDuplicate(input.sourceAssetId, input.targetAssetId, input.relationshipType)) {
		return {
			error: 'conflict',
			message: 'An identical active relationship already exists.',
			ok: false,
		};
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		const values: typeof assetRelationships.$inferInsert = {
			confidence: input.confidence ?? 'confirmed',
			createdBy: actorId,
			notes: input.notes ?? null,
			relationshipType: input.relationshipType,
			sourceAssetId: input.sourceAssetId,
			targetAssetId: input.targetAssetId,
			updatedBy: actorId,
			...(workspaceId !== undefined && workspaceId !== null ? { workspaceId } : {}),
		};
		tx.insert(assetRelationships).values(values).run();
		const created = tx
			.select()
			.from(assetRelationships)
			.where(eq(assetRelationships.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve relationship after creation');
		}
		recordRelationshipEvent(
			'create',
			created,
			actorId,
			`Linked asset #${created.sourceAssetId} —${created.relationshipType}→ #${created.targetAssetId}`,
			{ after: values }
		);
		return created;
	});

	return { ok: true, row };
}

/**
 * Update a relationship's type, confidence, or notes. Re-validates plausibility
 * and duplicates when the type changes. Records an `update` change event.
 *
 * @param id - Relationship id
 * @param input - Fields to change
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateRelationship(
	id: number,
	input: UpdateRelationshipInput,
	actorId: number
): RelationshipResult {
	const existing = getRelationshipById(id, false);
	if (!existing) {
		return { error: 'not_found', message: 'Relationship', ok: false };
	}

	const nextType = input.relationshipType ?? existing.relationshipType;

	if (input.relationshipType && input.relationshipType !== existing.relationshipType) {
		if (!input.allowUnusual) {
			const sourceType = activeAssetType(existing.sourceAssetId);
			const targetType = activeAssetType(existing.targetAssetId);
			if (sourceType && targetType) {
				const problem = checkRelationshipPlausibility(nextType, sourceType, targetType);
				if (problem) {
					return { error: 'validation', message: problem, ok: false };
				}
			}
		}
		if (findDuplicate(existing.sourceAssetId, existing.targetAssetId, nextType, id)) {
			return {
				error: 'conflict',
				message: 'An identical active relationship already exists.',
				ok: false,
			};
		}
	}

	const changes: Record<string, unknown> = {};
	if (input.relationshipType !== undefined) changes.relationshipType = input.relationshipType;
	if (input.confidence !== undefined) changes.confidence = input.confidence;
	if (input.notes !== undefined) changes.notes = input.notes;

	if (Object.keys(changes).length === 0) {
		return { ok: true, row: existing };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(assetRelationships)
			.set({ ...changes, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(assetRelationships.id, id))
			.run();
		const updated = tx
			.select()
			.from(assetRelationships)
			.where(eq(assetRelationships.id, id))
			.get();
		if (!updated) {
			throw new Error('Failed to retrieve relationship after update');
		}
		recordRelationshipEvent('update', updated, actorId, `Updated relationship #${id}`, {
			after: changes,
		});
		return updated;
	});

	return { ok: true, row };
}

/**
 * Soft-delete a relationship and record a `delete` change event.
 *
 * @param id - Relationship id
 * @param actorId - Id of the user performing the action
 * @returns The soft-deleted row, or null if not found / already deleted
 */
function softDeleteRelationship(id: number, actorId: number): null | RelationshipRow {
	const existing = getRelationshipById(id, false);
	if (!existing) {
		return null;
	}

	const db = getDb();
	return db.transaction((tx) => {
		tx.update(assetRelationships)
			.set({
				deletedAt: new Date(),
				deletedBy: actorId,
				isDeleted: true,
				updatedAt: new Date(),
				updatedBy: actorId,
			})
			.where(eq(assetRelationships.id, id))
			.run();
		const deleted = tx
			.select()
			.from(assetRelationships)
			.where(eq(assetRelationships.id, id))
			.get();
		if (!deleted) {
			throw new Error('Failed to retrieve relationship after delete');
		}
		recordRelationshipEvent('delete', deleted, actorId, `Removed relationship #${id}`);
		return deleted;
	});
}

export type {
	CreateRelationshipInput,
	EnrichedRelationshipRow,
	ListRelationshipsOptions,
	RelationshipResult,
	RelationshipRow,
	UpdateRelationshipInput,
};
export {
	createRelationship,
	getRelationshipById,
	listRelationships,
	listRelationshipsEnriched,
	softDeleteRelationship,
	updateRelationship,
};

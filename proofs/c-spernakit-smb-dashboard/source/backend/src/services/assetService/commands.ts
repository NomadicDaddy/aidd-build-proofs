import { and, eq, sql } from 'drizzle-orm';

import type { AssetRow, CreateAssetInput, UpdateAssetInput } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';
import { buildWriteValues, recordChangeEvent } from './helpers.ts';

/**
 * Create a new asset and record a `create` change event.
 *
 * @param input - Asset fields (name and assetType required)
 * @param actorId - Id of the user performing the action
 * @param workspaceId - Optional workspace scope
 * @returns The created asset row
 */
function createAsset(
	input: CreateAssetInput,
	actorId: number,
	workspaceId?: null | number
): AssetRow {
	const db = getDb();

	return db.transaction((tx) => {
		const values = buildWriteValues(input);
		values.createdBy = actorId;
		values.updatedBy = actorId;
		if (workspaceId !== undefined && workspaceId !== null) {
			values.workspaceId = workspaceId;
		}

		tx.insert(assets)
			.values(values as typeof assets.$inferInsert)
			.run();

		const created = tx
			.select()
			.from(assets)
			.where(eq(assets.id, sql`last_insert_rowid()`))
			.get();

		if (!created) {
			throw new Error('Failed to retrieve asset after creation');
		}

		recordChangeEvent({
			action: 'create',
			actorId,
			assetId: created.id,
			changes: { after: values },
			summary: `Created asset "${created.name}"`,
		});

		return created;
	});
}

/**
 * Update an existing (non-deleted) asset and record an `update` change event.
 *
 * @param id - Asset id
 * @param input - Fields to change
 * @param actorId - Id of the user performing the action
 * @returns The updated asset row, or null if the asset does not exist
 */
function updateAsset(id: number, input: UpdateAssetInput, actorId: number): AssetRow | null {
	const db = getDb();

	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(assets)
			.where(and(eq(assets.id, id), eq(assets.isDeleted, false)))
			.get();

		if (!existing) {
			return null;
		}

		const values = buildWriteValues(input);
		if (Object.keys(values).length === 0) {
			return existing;
		}
		values.updatedBy = actorId;
		values.updatedAt = new Date();

		tx.update(assets)
			.set(values as Partial<typeof assets.$inferInsert>)
			.where(eq(assets.id, id))
			.run();

		const updated = tx.select().from(assets).where(eq(assets.id, id)).get();
		if (!updated) {
			throw new Error('Failed to retrieve asset after update');
		}

		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			if (key === 'updatedAt' || key === 'updatedBy') continue;
			before[key] = (existing as Record<string, unknown>)[key];
		}

		recordChangeEvent({
			action: 'update',
			actorId,
			assetId: id,
			changes: { after: values, before },
			summary: `Updated asset "${updated.name}"`,
		});

		return updated;
	});
}

/**
 * Soft-delete an asset (recoverable) and record a `delete` change event.
 *
 * @param id - Asset id
 * @param actorId - Id of the user performing the action
 * @returns The soft-deleted asset row, or null if not found / already deleted
 */
function softDeleteAsset(id: number, actorId: number): AssetRow | null {
	const db = getDb();

	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(assets)
			.where(and(eq(assets.id, id), eq(assets.isDeleted, false)))
			.get();

		if (!existing) {
			return null;
		}

		tx.update(assets)
			.set({
				deletedAt: new Date(),
				deletedBy: actorId,
				isDeleted: true,
				updatedAt: new Date(),
				updatedBy: actorId,
			})
			.where(eq(assets.id, id))
			.run();

		const deleted = tx.select().from(assets).where(eq(assets.id, id)).get();
		if (!deleted) {
			throw new Error('Failed to retrieve asset after delete');
		}

		recordChangeEvent({
			action: 'delete',
			actorId,
			assetId: id,
			summary: `Soft-deleted asset "${deleted.name}"`,
		});

		return deleted;
	});
}

/**
 * Restore a soft-deleted asset and record a `restore` change event.
 *
 * @param id - Asset id
 * @param actorId - Id of the user performing the action
 * @returns The restored asset row, or null if not found / not deleted
 */
function restoreAsset(id: number, actorId: number): AssetRow | null {
	const db = getDb();

	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(assets)
			.where(and(eq(assets.id, id), eq(assets.isDeleted, true)))
			.get();

		if (!existing) {
			return null;
		}

		tx.update(assets)
			.set({
				deletedAt: null,
				deletedBy: null,
				isDeleted: false,
				updatedAt: new Date(),
				updatedBy: actorId,
			})
			.where(eq(assets.id, id))
			.run();

		const restored = tx.select().from(assets).where(eq(assets.id, id)).get();
		if (!restored) {
			throw new Error('Failed to retrieve asset after restore');
		}

		recordChangeEvent({
			action: 'restore',
			actorId,
			assetId: id,
			summary: `Restored asset "${restored.name}"`,
		});

		return restored;
	});
}

/**
 * Archive an active asset: mark it `retired` and stamp its decommission date
 * while keeping the record queryable. Records an `archive` change event.
 *
 * @param id - Asset id
 * @param actorId - Id of the user performing the action
 * @returns The archived asset row, or null if not found / already deleted
 */
function archiveAsset(id: number, actorId: number): AssetRow | null {
	const db = getDb();

	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(assets)
			.where(and(eq(assets.id, id), eq(assets.isDeleted, false)))
			.get();

		if (!existing) {
			return null;
		}

		const decommissionedAt = existing.decommissionedAt ?? new Date();

		tx.update(assets)
			.set({
				decommissionedAt,
				status: 'retired',
				updatedAt: new Date(),
				updatedBy: actorId,
			})
			.where(eq(assets.id, id))
			.run();

		const archived = tx.select().from(assets).where(eq(assets.id, id)).get();
		if (!archived) {
			throw new Error('Failed to retrieve asset after archive');
		}

		recordChangeEvent({
			action: 'archive',
			actorId,
			assetId: id,
			changes: { after: { status: 'retired' }, before: { status: existing.status } },
			summary: `Archived asset "${archived.name}"`,
		});

		return archived;
	});
}

export { archiveAsset, createAsset, restoreAsset, softDeleteAsset, updateAsset };

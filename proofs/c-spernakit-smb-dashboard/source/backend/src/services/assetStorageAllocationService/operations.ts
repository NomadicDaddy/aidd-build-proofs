import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type {
	StorageAllocationResult,
	StorageAllocationRow,
	StorageAllocationWritableFields,
	StorageConsumer,
} from './shared.ts';

import { getDb } from '../../db/index.ts';
import { assetStorageAllocations } from '../../db/schema/assetProfiles.ts';
import { assets } from '../../db/schema/assets.ts';
import {
	activeAssetExists,
	allocationLabel,
	buildAllocationValues,
	capacityError,
	recordAllocationEvent,
} from './shared.ts';

/**
 * List an asset's storage allocations, largest capacity first then oldest.
 *
 * @param assetId - Asset id whose allocations to load
 * @returns The allocation rows (empty array when the asset has none)
 */
function listStorageAllocations(assetId: number): StorageAllocationRow[] {
	const db = getDb();
	return db
		.select()
		.from(assetStorageAllocations)
		.where(eq(assetStorageAllocations.assetId, assetId))
		.orderBy(desc(assetStorageAllocations.capacityGb), asc(assetStorageAllocations.id))
		.all();
}

/**
 * List the allocations that draw from an asset acting as a storage pool, joined
 * to each consuming asset's name. Powers the "assets depending on this pool"
 * view on a storage appliance's detail page.
 *
 * @param poolAssetId - Asset id acting as the storage pool/appliance
 * @returns The consuming allocations with the consumer asset name resolved
 */
function listStorageConsumers(poolAssetId: number): StorageConsumer[] {
	const db = getDb();
	const rows = db
		.select({
			allocation: assetStorageAllocations,
			consumerAssetName: assets.name,
		})
		.from(assetStorageAllocations)
		.leftJoin(assets, eq(assetStorageAllocations.assetId, assets.id))
		.where(eq(assetStorageAllocations.storagePoolAssetId, poolAssetId))
		.orderBy(desc(assetStorageAllocations.capacityGb), asc(assetStorageAllocations.id))
		.all();
	return rows.map((r) => ({ ...r.allocation, consumerAssetName: r.consumerAssetName }));
}

/**
 * Get a single allocation scoped to its owning asset.
 *
 * @param assetId - Owning asset id
 * @param allocationId - Allocation id
 * @returns The allocation row, or null when it does not belong to the asset
 */
function getStorageAllocation(assetId: number, allocationId: number): null | StorageAllocationRow {
	const db = getDb();
	return (
		db
			.select()
			.from(assetStorageAllocations)
			.where(
				and(
					eq(assetStorageAllocations.id, allocationId),
					eq(assetStorageAllocations.assetId, assetId)
				)
			)
			.get() ?? null
	);
}

/**
 * Create a storage allocation for an asset. Validates the asset exists, the
 * referenced storage-pool asset (when set) is active, and used capacity does not
 * exceed total capacity. Records a `create` change event on the asset trail.
 *
 * @param assetId - Asset id the allocation belongs to
 * @param input - Allocation fields to set
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function createStorageAllocation(
	assetId: number,
	input: StorageAllocationWritableFields,
	actorId: number
): StorageAllocationResult {
	if (!activeAssetExists(assetId)) {
		return { error: 'not_found', message: 'Asset', ok: false };
	}
	if (
		input.storagePoolAssetId !== undefined &&
		input.storagePoolAssetId !== null &&
		!activeAssetExists(input.storagePoolAssetId)
	) {
		return { error: 'validation', message: 'Storage pool asset does not exist.', ok: false };
	}
	const invalid = capacityError(input.capacityGb ?? null, input.usedGb ?? null);
	if (invalid) {
		return { error: 'validation', message: invalid, ok: false };
	}

	const values = buildAllocationValues(input);
	const db = getDb();
	const row = db.transaction((tx) => {
		tx.insert(assetStorageAllocations)
			.values({
				...values,
				assetId,
				createdBy: actorId,
				updatedBy: actorId,
			} as typeof assetStorageAllocations.$inferInsert)
			.run();
		const created = tx
			.select()
			.from(assetStorageAllocations)
			.where(eq(assetStorageAllocations.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve storage allocation after creation');
		}
		recordAllocationEvent(
			'create',
			created,
			actorId,
			`Added storage allocation ${allocationLabel(created)}`,
			{ after: values }
		);
		return created;
	});

	return { ok: true, row };
}

/**
 * Update a storage allocation belonging to an asset. Validates the allocation
 * belongs to the asset, the referenced pool (when changed) is active, and the
 * effective used capacity does not exceed the effective total capacity. Records
 * an `update` change event.
 *
 * @param assetId - Owning asset id
 * @param allocationId - Allocation id to update
 * @param input - Fields to change (undefined skipped, null clears)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateStorageAllocation(
	assetId: number,
	allocationId: number,
	input: StorageAllocationWritableFields,
	actorId: number
): StorageAllocationResult {
	const existing = getStorageAllocation(assetId, allocationId);
	if (!existing) {
		return { error: 'not_found', message: 'Storage allocation', ok: false };
	}
	if (
		input.storagePoolAssetId !== undefined &&
		input.storagePoolAssetId !== null &&
		!activeAssetExists(input.storagePoolAssetId)
	) {
		return { error: 'validation', message: 'Storage pool asset does not exist.', ok: false };
	}
	const effectiveCapacity =
		input.capacityGb === undefined ? existing.capacityGb : input.capacityGb;
	const effectiveUsed = input.usedGb === undefined ? existing.usedGb : input.usedGb;
	const invalid = capacityError(effectiveCapacity, effectiveUsed);
	if (invalid) {
		return { error: 'validation', message: invalid, ok: false };
	}

	const values = buildAllocationValues(input);
	if (Object.keys(values).length === 0) {
		return { ok: true, row: existing };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(assetStorageAllocations)
			.set({ ...values, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(assetStorageAllocations.id, allocationId))
			.run();
		const updated = tx
			.select()
			.from(assetStorageAllocations)
			.where(eq(assetStorageAllocations.id, allocationId))
			.get();
		if (!updated) {
			throw new Error('Failed to retrieve storage allocation after update');
		}
		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			before[key] = (existing as Record<string, unknown>)[key];
		}
		recordAllocationEvent(
			'update',
			updated,
			actorId,
			`Updated storage allocation ${allocationLabel(updated)}`,
			{ after: values, before }
		);
		return updated;
	});

	return { ok: true, row };
}

/**
 * Delete a storage allocation belonging to an asset and record a `delete` change
 * event. Allocations are hard-deleted (they carry no soft-delete columns).
 *
 * @param assetId - Owning asset id
 * @param allocationId - Allocation id to delete
 * @param actorId - Id of the user performing the action
 * @returns The removed row, or null when it does not belong to the asset
 */
function deleteStorageAllocation(
	assetId: number,
	allocationId: number,
	actorId: number
): null | StorageAllocationRow {
	const existing = getStorageAllocation(assetId, allocationId);
	if (!existing) {
		return null;
	}

	const db = getDb();
	db.transaction((tx) => {
		tx.delete(assetStorageAllocations)
			.where(eq(assetStorageAllocations.id, allocationId))
			.run();
		recordAllocationEvent(
			'delete',
			existing,
			actorId,
			`Removed storage allocation ${allocationLabel(existing)}`
		);
	});

	return existing;
}

export {
	createStorageAllocation,
	deleteStorageAllocation,
	getStorageAllocation,
	listStorageAllocations,
	listStorageConsumers,
	updateStorageAllocation,
};

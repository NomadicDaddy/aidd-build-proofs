import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { type assetStorageAllocations } from '../../db/schema/assetProfiles.ts';
import { assets } from '../../db/schema/assets.ts';

type StorageAllocationRow = typeof assetStorageAllocations.$inferSelect;

/** A storage allocation joined to the consuming asset's name, for pool consumer views. */
interface StorageConsumer extends StorageAllocationRow {
	consumerAssetName: null | string;
}

/**
 * Fields a client may set on an asset's storage allocation. Every field is
 * optional; on create, omitted fields fall back to the column default (`null`).
 * On update, `undefined` leaves a column untouched and `null` clears it.
 */
interface StorageAllocationWritableFields {
	capacityGb?: null | number;
	mountPoint?: null | string;
	name?: null | string;
	notes?: null | string;
	storagePoolAssetId?: null | number;
	storageType?: null | string;
	usedGb?: null | number;
}

/** Column keys the caller controls, used to build insert/update payloads. */
const WRITABLE_KEYS: (keyof StorageAllocationWritableFields)[] = [
	'capacityGb',
	'mountPoint',
	'name',
	'notes',
	'storagePoolAssetId',
	'storageType',
	'usedGb',
];

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type StorageAllocationResult =
	| { error: 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: StorageAllocationRow };

/**
 * Append a storage-allocation write to the asset_change_events audit trail so it
 * surfaces in the owning asset's history. Mirrors the fire-and-forget recording
 * contract used by the network-interface and port services.
 *
 * @param action - The change action (create, update, delete)
 * @param row - The allocation row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordAllocationEvent(
	action: string,
	row: StorageAllocationRow,
	actorId: number,
	summary: string,
	changes?: Record<string, unknown>
): void {
	const db = getDb();
	db.insert(assetChangeEvents)
		.values({
			action,
			actorId,
			assetId: row.assetId,
			...(changes !== undefined ? { changes } : {}),
			entityId: row.id,
			entityType: 'asset_storage_allocation',
			summary,
		})
		.run();
}

/**
 * Whether an active (non-deleted) asset with the given id exists.
 *
 * @param assetId - Asset id to check
 * @returns True when the asset exists and is not soft-deleted
 */
function activeAssetExists(assetId: number): boolean {
	const db = getDb();
	const row = db
		.select({ id: assets.id })
		.from(assets)
		.where(and(eq(assets.id, assetId), eq(assets.isDeleted, false)))
		.get();
	return row !== undefined;
}

/**
 * Human label for an allocation in a change-event summary.
 *
 * @param row - The allocation row to label
 * @returns The allocation name, mount point, storage type, or `#id` fallback
 */
function allocationLabel(row: StorageAllocationRow): string {
	return row.name ?? row.mountPoint ?? row.storageType ?? `#${row.id}`;
}

/**
 * Validate the effective capacity math for an allocation. Used capacity may not
 * exceed total capacity when both are known (after merging an update over the
 * existing row). Returns an error message, or null when the figures are valid.
 *
 * @param capacityGb - Effective total capacity (null when unknown)
 * @param usedGb - Effective used capacity (null when unknown)
 * @returns An error message when used exceeds total, otherwise null
 */
function capacityError(capacityGb: null | number, usedGb: null | number): null | string {
	if (capacityGb === null || usedGb === null) return null;
	if (usedGb > capacityGb) {
		return 'Used capacity cannot exceed total capacity.';
	}
	return null;
}

/**
 * Build the concrete column payload from the writable-field subset.
 *
 * @param input - The writable allocation fields to include (undefined skipped)
 * @returns A record of column values suitable for insert/update
 */
function buildAllocationValues(input: StorageAllocationWritableFields): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key of WRITABLE_KEYS) {
		const value = input[key];
		if (value !== undefined) values[key] = value;
	}
	return values;
}

export type {
	StorageAllocationResult,
	StorageAllocationRow,
	StorageAllocationWritableFields,
	StorageConsumer,
};
export {
	activeAssetExists,
	allocationLabel,
	buildAllocationValues,
	capacityError,
	recordAllocationEvent,
};

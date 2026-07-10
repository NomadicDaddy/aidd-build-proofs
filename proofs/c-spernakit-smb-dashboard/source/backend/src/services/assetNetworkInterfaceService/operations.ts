import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type {
	NetworkInterfaceResult,
	NetworkInterfaceRow,
	NetworkInterfaceWritableFields,
} from './shared.ts';

import { getDb } from '../../db/index.ts';
import { assetNetworkInterfaces } from '../../db/schema/assetProfiles.ts';
import {
	activeAssetExists,
	activeZoneExists,
	buildInterfaceValues,
	demoteOtherPrimaries,
	interfaceLabel,
	recordInterfaceEvent,
} from './shared.ts';

/**
 * List an asset's network interfaces, primary first then oldest to newest.
 *
 * @param assetId - Asset id whose interfaces to load
 * @returns The interface rows (empty array when the asset has none)
 */
function listNetworkInterfaces(assetId: number): NetworkInterfaceRow[] {
	const db = getDb();
	return db
		.select()
		.from(assetNetworkInterfaces)
		.where(eq(assetNetworkInterfaces.assetId, assetId))
		.orderBy(desc(assetNetworkInterfaces.isPrimary), asc(assetNetworkInterfaces.id))
		.all();
}

/**
 * Get a single interface scoped to its owning asset.
 *
 * @param assetId - Owning asset id
 * @param interfaceId - Interface id
 * @returns The interface row, or null when it does not belong to the asset
 */
function getNetworkInterface(assetId: number, interfaceId: number): NetworkInterfaceRow | null {
	const db = getDb();
	return (
		db
			.select()
			.from(assetNetworkInterfaces)
			.where(
				and(
					eq(assetNetworkInterfaces.id, interfaceId),
					eq(assetNetworkInterfaces.assetId, assetId)
				)
			)
			.get() ?? null
	);
}

/**
 * Create a network interface for an asset. Validates the asset exists and the
 * referenced network zone (when set) is active. Records a `create` change event
 * on the asset trail. Enforces a single primary interface per asset.
 *
 * @param assetId - Asset id the interface belongs to
 * @param input - Interface fields to set
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function createNetworkInterface(
	assetId: number,
	input: NetworkInterfaceWritableFields,
	actorId: number
): NetworkInterfaceResult {
	if (!activeAssetExists(assetId)) {
		return { error: 'not_found', message: 'Asset', ok: false };
	}
	if (
		input.networkZoneId !== undefined &&
		input.networkZoneId !== null &&
		!activeZoneExists(input.networkZoneId)
	) {
		return { error: 'validation', message: 'Network zone does not exist.', ok: false };
	}

	const values = buildInterfaceValues(input);
	const db = getDb();
	const row = db.transaction((tx) => {
		tx.insert(assetNetworkInterfaces)
			.values({
				...values,
				assetId,
				createdBy: actorId,
				updatedBy: actorId,
			} as typeof assetNetworkInterfaces.$inferInsert)
			.run();
		const created = tx
			.select()
			.from(assetNetworkInterfaces)
			.where(eq(assetNetworkInterfaces.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve network interface after creation');
		}
		if (created.isPrimary) {
			demoteOtherPrimaries(tx, assetId, created.id);
		}
		recordInterfaceEvent(
			'create',
			created,
			actorId,
			`Added network interface ${interfaceLabel(created)}`,
			{ after: values }
		);
		return created;
	});

	return { ok: true, row };
}

/**
 * Update a network interface belonging to an asset. Validates the interface
 * belongs to the asset and the referenced zone (when changed) is active.
 * Records an `update` change event and preserves the single-primary invariant.
 *
 * @param assetId - Owning asset id
 * @param interfaceId - Interface id to update
 * @param input - Fields to change (undefined skipped, null clears)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateNetworkInterface(
	assetId: number,
	interfaceId: number,
	input: NetworkInterfaceWritableFields,
	actorId: number
): NetworkInterfaceResult {
	const existing = getNetworkInterface(assetId, interfaceId);
	if (!existing) {
		return { error: 'not_found', message: 'Network interface', ok: false };
	}
	if (
		input.networkZoneId !== undefined &&
		input.networkZoneId !== null &&
		!activeZoneExists(input.networkZoneId)
	) {
		return { error: 'validation', message: 'Network zone does not exist.', ok: false };
	}

	const values = buildInterfaceValues(input);
	if (Object.keys(values).length === 0) {
		return { ok: true, row: existing };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(assetNetworkInterfaces)
			.set({ ...values, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(assetNetworkInterfaces.id, interfaceId))
			.run();
		const updated = tx
			.select()
			.from(assetNetworkInterfaces)
			.where(eq(assetNetworkInterfaces.id, interfaceId))
			.get();
		if (!updated) {
			throw new Error('Failed to retrieve network interface after update');
		}
		if (updated.isPrimary) {
			demoteOtherPrimaries(tx, assetId, updated.id);
		}
		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			before[key] = (existing as Record<string, unknown>)[key];
		}
		recordInterfaceEvent(
			'update',
			updated,
			actorId,
			`Updated network interface ${interfaceLabel(updated)}`,
			{ after: values, before }
		);
		return updated;
	});

	return { ok: true, row };
}

/**
 * Delete a network interface belonging to an asset and record a `delete` change
 * event. Interfaces are hard-deleted (they carry no soft-delete columns).
 *
 * @param assetId - Owning asset id
 * @param interfaceId - Interface id to delete
 * @param actorId - Id of the user performing the action
 * @returns The removed row, or null when it does not belong to the asset
 */
function deleteNetworkInterface(
	assetId: number,
	interfaceId: number,
	actorId: number
): NetworkInterfaceRow | null {
	const existing = getNetworkInterface(assetId, interfaceId);
	if (!existing) {
		return null;
	}

	const db = getDb();
	db.transaction((tx) => {
		tx.delete(assetNetworkInterfaces).where(eq(assetNetworkInterfaces.id, interfaceId)).run();
		recordInterfaceEvent(
			'delete',
			existing,
			actorId,
			`Removed network interface ${interfaceLabel(existing)}`
		);
	});

	return existing;
}

export {
	createNetworkInterface,
	deleteNetworkInterface,
	getNetworkInterface,
	listNetworkInterfaces,
	updateNetworkInterface,
};

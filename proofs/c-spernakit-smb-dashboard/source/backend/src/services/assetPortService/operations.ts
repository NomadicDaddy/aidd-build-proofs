import { and, asc, eq, sql } from 'drizzle-orm';

import type { AssetPortRow, PortResult, PortWritableFields } from './shared.ts';

import { getDb } from '../../db/index.ts';
import { assetPorts } from '../../db/schema/services.ts';
import {
	activeAssetExists,
	buildPortValues,
	portLabel,
	recordPortEvent,
	validateServiceRef,
} from './shared.ts';

/**
 * List an asset's ports ordered by port number then protocol, giving a stable,
 * scannable layout for the detail page.
 *
 * @param assetId - Asset id whose ports to load
 * @returns The port rows (empty array when the asset has none)
 */
function listAssetPorts(assetId: number): AssetPortRow[] {
	const db = getDb();
	return db
		.select()
		.from(assetPorts)
		.where(eq(assetPorts.assetId, assetId))
		.orderBy(asc(assetPorts.portNumber), asc(assetPorts.protocol), asc(assetPorts.id))
		.all();
}

/**
 * Get a single port scoped to its owning asset.
 *
 * @param assetId - Owning asset id
 * @param portId - Port id
 * @returns The port row, or null when it does not belong to the asset
 */
function getAssetPort(assetId: number, portId: number): AssetPortRow | null {
	const db = getDb();
	return (
		db
			.select()
			.from(assetPorts)
			.where(and(eq(assetPorts.id, portId), eq(assetPorts.assetId, assetId)))
			.get() ?? null
	);
}

/**
 * Create a port record for an asset. Validates the asset exists, the referenced
 * catalog service (when set) is active, and that a port number is supplied.
 * Records a `create` change event on the asset trail.
 *
 * @param assetId - Asset id the port belongs to
 * @param input - Port fields to set (portNumber required)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function createAssetPort(assetId: number, input: PortWritableFields, actorId: number): PortResult {
	if (!activeAssetExists(assetId)) {
		return { error: 'not_found', message: 'Asset', ok: false };
	}
	if (input.portNumber === undefined) {
		return { error: 'validation', message: 'A port number is required.', ok: false };
	}
	const serviceError = validateServiceRef(input.serviceId);
	if (serviceError) return serviceError;

	const values = buildPortValues(input);
	const db = getDb();
	const row = db.transaction((tx) => {
		tx.insert(assetPorts)
			.values({
				...values,
				assetId,
				createdBy: actorId,
				updatedBy: actorId,
			} as typeof assetPorts.$inferInsert)
			.run();
		const created = tx
			.select()
			.from(assetPorts)
			.where(eq(assetPorts.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve port after creation');
		}
		recordPortEvent('create', created, actorId, `Documented port ${portLabel(created)}`, {
			after: values,
		});
		return created;
	});

	return { ok: true, row };
}

/**
 * Update a port belonging to an asset. Validates the port belongs to the asset
 * and the referenced service (when changed) is active. Records an `update`
 * change event.
 *
 * @param assetId - Owning asset id
 * @param portId - Port id to update
 * @param input - Fields to change (undefined skipped, null clears)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateAssetPort(
	assetId: number,
	portId: number,
	input: PortWritableFields,
	actorId: number
): PortResult {
	const existing = getAssetPort(assetId, portId);
	if (!existing) {
		return { error: 'not_found', message: 'Port', ok: false };
	}
	const serviceError = validateServiceRef(input.serviceId);
	if (serviceError) return serviceError;

	const values = buildPortValues(input);
	if (Object.keys(values).length === 0) {
		return { ok: true, row: existing };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(assetPorts)
			.set({ ...values, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(assetPorts.id, portId))
			.run();
		const updated = tx.select().from(assetPorts).where(eq(assetPorts.id, portId)).get();
		if (!updated) {
			throw new Error('Failed to retrieve port after update');
		}
		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			before[key] = (existing as Record<string, unknown>)[key];
		}
		recordPortEvent('update', updated, actorId, `Updated port ${portLabel(updated)}`, {
			after: values,
			before,
		});
		return updated;
	});

	return { ok: true, row };
}

/**
 * Delete a port belonging to an asset and record a `delete` change event. Ports
 * are hard-deleted (they carry no soft-delete columns).
 *
 * @param assetId - Owning asset id
 * @param portId - Port id to delete
 * @param actorId - Id of the user performing the action
 * @returns The removed row, or null when it does not belong to the asset
 */
function deleteAssetPort(assetId: number, portId: number, actorId: number): AssetPortRow | null {
	const existing = getAssetPort(assetId, portId);
	if (!existing) {
		return null;
	}

	const db = getDb();
	db.transaction((tx) => {
		tx.delete(assetPorts).where(eq(assetPorts.id, portId)).run();
		recordPortEvent('delete', existing, actorId, `Removed port ${portLabel(existing)}`);
	});

	return existing;
}

export { createAssetPort, deleteAssetPort, getAssetPort, listAssetPorts, updateAssetPort };

import { and, eq, sql } from 'drizzle-orm';

import type { ServiceRow } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { serviceCatalog } from '../../db/schema/services.ts';

/**
 * Append a service write to the asset_change_events audit trail. Services are
 * not assets, so the row is anchored with a null assetId and an entityType of
 * `service`; the entry surfaces in the general audit view, not an asset history.
 * Mirrors the asset service's fire-and-forget recording contract.
 *
 * @param action - The change action (create, update, delete)
 * @param row - The service row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordServiceEvent(
	action: string,
	row: ServiceRow,
	actorId: number,
	summary: string,
	changes?: Record<string, unknown>
): void {
	const db = getDb();
	db.insert(assetChangeEvents)
		.values({
			action,
			actorId,
			assetId: null,
			...(changes !== undefined ? { changes } : {}),
			entityId: row.id,
			entityType: 'service',
			summary,
		})
		.run();
}

/**
 * Check whether an active (non-deleted) service already uses the given name.
 * Comparison is case-insensitive and dialect-portable (lower()).
 *
 * @param name - Candidate service name
 * @param excludeId - Service id to ignore (used when renaming an existing service)
 * @returns True if another active service already has the name
 */
function serviceNameExists(name: string, excludeId?: number): boolean {
	const db = getDb();
	const conditions = [
		eq(sql`lower(${serviceCatalog.name})`, name.trim().toLowerCase()),
		eq(serviceCatalog.isDeleted, false),
	];
	if (excludeId !== undefined) {
		conditions.push(sql`${serviceCatalog.id} <> ${excludeId}`);
	}
	const row = db
		.select({ id: serviceCatalog.id })
		.from(serviceCatalog)
		.where(and(...conditions))
		.get();
	return row !== undefined;
}

/**
 * Get a single service by id.
 *
 * @param id - Service id
 * @param includeDeleted - When true, soft-deleted rows are returned too
 * @param workspaceScope - When set, the service must belong to this workspace
 *   or null is returned; enforces workspace boundaries on reads
 * @returns The service row, or null if not found
 */
function getServiceById(
	id: number,
	includeDeleted = false,
	workspaceScope: null | number = null
): null | ServiceRow {
	const db = getDb();
	const conditions = [eq(serviceCatalog.id, id)];
	if (!includeDeleted) {
		conditions.push(eq(serviceCatalog.isDeleted, false));
	}
	if (workspaceScope !== null) {
		conditions.push(eq(serviceCatalog.workspaceId, workspaceScope));
	}
	return (
		db
			.select()
			.from(serviceCatalog)
			.where(and(...conditions))
			.get() ?? null
	);
}

export { getServiceById, recordServiceEvent, serviceNameExists };

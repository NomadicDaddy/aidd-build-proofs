import type { CriticalityLevel } from 'spernakit-shared';

import { and, eq, ne } from 'drizzle-orm';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { assets } from '../../db/schema/assets.ts';
import { assetServices, serviceCatalog } from '../../db/schema/services.ts';

type AssetServiceRow = typeof assetServices.$inferSelect;

/**
 * A service assigned to an asset, resolved to the service's display name,
 * category, and criticality so the asset detail page can render the assignment
 * without a second round-trip. Returned by {@link listAssignedServices}.
 */
interface AssignedService {
	assignmentId: number;
	isPrimary: boolean;
	notes: null | string;
	role: null | string;
	serviceCategory: null | string;
	serviceCriticality: CriticalityLevel | null;
	serviceId: number;
	serviceName: string;
}

/**
 * Fields a client may set on an asset-to-service assignment. `serviceId` is
 * required when creating; on update `undefined` leaves a column untouched and
 * `null` clears the nullable text columns.
 */
interface AssignmentWritableFields {
	isPrimary?: boolean;
	notes?: null | string;
	role?: null | string;
	serviceId?: number;
}

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type AssignmentResult =
	| { error: 'conflict' | 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: AssetServiceRow };

/** Column keys the caller controls on update (serviceId is create-only). */
const UPDATABLE_KEYS: (keyof AssignmentWritableFields)[] = ['isPrimary', 'notes', 'role'];

/**
 * Append a service-assignment write to the asset_change_events audit trail so it
 * surfaces in the owning asset's history. Mirrors the fire-and-forget recording
 * contract used by the asset and network-interface services.
 *
 * @param action - The change action (create, update, delete)
 * @param row - The assignment row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordAssignmentEvent(
	action: string,
	row: AssetServiceRow,
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
			entityType: 'asset_service',
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
 * Resolve an active (non-deleted) catalog service's name, or null when it does
 * not exist / has been soft-deleted.
 *
 * @param serviceId - Service id to resolve
 * @returns The service name, or null when the service is not assignable
 */
function activeServiceName(serviceId: number): null | string {
	const db = getDb();
	const row = db
		.select({ name: serviceCatalog.name })
		.from(serviceCatalog)
		.where(and(eq(serviceCatalog.id, serviceId), eq(serviceCatalog.isDeleted, false)))
		.get();
	return row?.name ?? null;
}

/**
 * Clear the primary flag on every other asset assigned to the same service,
 * keeping at most one primary backing asset per service (the semantic the
 * service detail's backing-asset ordering relies on).
 *
 * @param tx - The active transaction handle
 * @param serviceId - The service whose other primary assignments to demote
 * @param keepId - Assignment id that should remain primary
 */
function demoteOtherPrimaries(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	serviceId: number,
	keepId: number
): void {
	tx.update(assetServices)
		.set({ isPrimary: false })
		.where(
			and(
				eq(assetServices.serviceId, serviceId),
				ne(assetServices.id, keepId),
				eq(assetServices.isPrimary, true)
			)
		)
		.run();
}

export type { AssetServiceRow, AssignedService, AssignmentResult, AssignmentWritableFields };
export {
	activeAssetExists,
	activeServiceName,
	demoteOtherPrimaries,
	recordAssignmentEvent,
	UPDATABLE_KEYS,
};

import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { assets } from '../../db/schema/assets.ts';
import { type assetPorts, serviceCatalog } from '../../db/schema/services.ts';

type AssetPortRow = typeof assetPorts.$inferSelect;

/**
 * Fields a client may set on an asset port. `portNumber` is required when
 * creating; every other field is optional. On create, omitted fields fall back
 * to the column default (`null` for the text/timestamp columns, and the enum
 * defaults `tcp` / `unknown` / `documented` / `expected`). On update,
 * `undefined` leaves a column untouched and `null` clears the nullable columns.
 *
 * `verifiedAt` is accepted as an ISO-8601 string (or `null` to clear) and stored
 * in the timestamp column.
 */
interface PortWritableFields {
	exposureLevel?: string;
	notes?: null | string;
	portNumber?: number;
	protocol?: string;
	reviewState?: string;
	scope?: null | string;
	serviceId?: null | number;
	serviceName?: null | string;
	source?: string;
	verifiedAt?: null | string;
}

/** Column keys the caller controls, used to build insert/update payloads. */
const WRITABLE_KEYS: (keyof PortWritableFields)[] = [
	'exposureLevel',
	'notes',
	'portNumber',
	'protocol',
	'reviewState',
	'scope',
	'serviceId',
	'serviceName',
	'source',
];

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type PortResult =
	| { error: 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: AssetPortRow };

/**
 * Append a port write to the asset_change_events audit trail so it surfaces in
 * the owning asset's history. Mirrors the fire-and-forget recording contract
 * used by the asset, network-interface, and service-assignment services.
 *
 * @param action - The change action (create, update, delete)
 * @param row - The port row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordPortEvent(
	action: string,
	row: AssetPortRow,
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
			entityType: 'asset_port',
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
 * Whether an active (non-deleted) catalog service with the given id exists.
 *
 * @param serviceId - Service id to check
 * @returns True when the service exists and is not soft-deleted
 */
function activeServiceExists(serviceId: number): boolean {
	const db = getDb();
	const row = db
		.select({ id: serviceCatalog.id })
		.from(serviceCatalog)
		.where(and(eq(serviceCatalog.id, serviceId), eq(serviceCatalog.isDeleted, false)))
		.get();
	return row !== undefined;
}

/**
 * Human label for a port in a change-event summary, e.g. "TCP/443 (https)".
 *
 * @param row - The port row to label
 * @returns The protocol/port token, annotated with the service name when set
 */
function portLabel(row: AssetPortRow): string {
	const base = `${row.protocol.toUpperCase()}/${row.portNumber}`;
	return row.serviceName ? `${base} (${row.serviceName})` : base;
}

/**
 * Build the concrete column payload from the writable-field subset. The plain
 * columns are copied through {@link WRITABLE_KEYS}; `verifiedAt` is coerced from
 * an ISO string (or null) to a Date so Drizzle stores it in the timestamp column.
 *
 * @param input - The writable port fields to include (undefined skipped)
 * @returns A record of column values suitable for insert/update
 */
function buildPortValues(input: PortWritableFields): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key of WRITABLE_KEYS) {
		const value = input[key];
		if (value !== undefined) values[key] = value;
	}
	if (input.verifiedAt !== undefined) {
		values.verifiedAt = input.verifiedAt === null ? null : new Date(input.verifiedAt);
	}
	return values;
}

/**
 * Validate a referenced service id (when set) points at an active catalog
 * service. Returns a validation result the caller can short-circuit on.
 *
 * @param serviceId - The serviceId field from the input (may be undefined/null)
 * @returns A failed PortResult when the service is missing, otherwise null
 */
function validateServiceRef(serviceId: null | number | undefined): null | PortResult {
	if (serviceId !== undefined && serviceId !== null && !activeServiceExists(serviceId)) {
		return { error: 'validation', message: 'Service does not exist.', ok: false };
	}
	return null;
}

export type { AssetPortRow, PortResult, PortWritableFields };
export { activeAssetExists, buildPortValues, portLabel, recordPortEvent, validateServiceRef };

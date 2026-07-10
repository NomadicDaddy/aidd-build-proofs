import { and, eq, ne } from 'drizzle-orm';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { assetNetworkInterfaces } from '../../db/schema/assetProfiles.ts';
import { assets } from '../../db/schema/assets.ts';
import { networkZones } from '../../db/schema/infrastructure.ts';

type NetworkInterfaceRow = typeof assetNetworkInterfaces.$inferSelect;

/**
 * Fields a client may set on an asset's network interface. Every field is
 * optional; on create, omitted fields fall back to the column default (`null`
 * for the text/int columns, `false` for `isPrimary`). On update, `undefined`
 * leaves a column untouched and `null` clears it.
 */
interface NetworkInterfaceWritableFields {
	dnsName?: null | string;
	gateway?: null | string;
	ipAddress?: null | string;
	isPrimary?: boolean;
	macAddress?: null | string;
	name?: null | string;
	networkZoneId?: null | number;
	notes?: null | string;
	subnetMask?: null | string;
	vlanId?: null | number;
}

/** Column keys the caller controls, used to build insert/update payloads. */
const WRITABLE_KEYS: (keyof NetworkInterfaceWritableFields)[] = [
	'dnsName',
	'gateway',
	'ipAddress',
	'isPrimary',
	'macAddress',
	'name',
	'networkZoneId',
	'notes',
	'subnetMask',
	'vlanId',
];

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type NetworkInterfaceResult =
	| { error: 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: NetworkInterfaceRow };

/**
 * Append a network-interface write to the asset_change_events audit trail so it
 * surfaces in the owning asset's history. Mirrors the fire-and-forget recording
 * contract used by the asset and relationship services.
 *
 * @param action - The change action (create, update, delete)
 * @param row - The interface row after the write
 * @param actorId - Id of the user performing the action
 * @param summary - Human-readable summary line
 * @param changes - Optional before/after diff payload
 */
function recordInterfaceEvent(
	action: string,
	row: NetworkInterfaceRow,
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
			entityType: 'asset_network_interface',
			summary,
		})
		.run();
}

/**
 * Whether an active (non-deleted) network zone with the given id exists.
 *
 * @param zoneId - Network zone id to check
 * @returns True when the zone exists and is not soft-deleted
 */
function activeZoneExists(zoneId: number): boolean {
	const db = getDb();
	const row = db
		.select({ id: networkZones.id })
		.from(networkZones)
		.where(and(eq(networkZones.id, zoneId), eq(networkZones.isDeleted, false)))
		.get();
	return row !== undefined;
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
 * Human label for an interface in a change-event summary.
 *
 * @param row - The interface row to label
 * @returns The interface name, IP, MAC, or `#id` fallback
 */
function interfaceLabel(row: NetworkInterfaceRow): string {
	return row.name ?? row.ipAddress ?? row.macAddress ?? `#${row.id}`;
}

/**
 * Build the concrete column payload from the writable-field subset.
 *
 * @param input - The writable interface fields to include (undefined skipped)
 * @returns A record of column values suitable for insert/update
 */
function buildInterfaceValues(input: NetworkInterfaceWritableFields): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key of WRITABLE_KEYS) {
		const value = input[key];
		if (value !== undefined) values[key] = value;
	}
	return values;
}

/**
 * Clear the primary flag on every other interface of an asset, keeping at most
 * one primary interface per asset.
 *
 * @param tx - The active transaction handle
 * @param assetId - Owning asset id
 * @param keepId - Interface id that should remain primary (0 = none yet)
 */
function demoteOtherPrimaries(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	assetId: number,
	keepId: number
): void {
	tx.update(assetNetworkInterfaces)
		.set({ isPrimary: false })
		.where(
			and(
				eq(assetNetworkInterfaces.assetId, assetId),
				ne(assetNetworkInterfaces.id, keepId),
				eq(assetNetworkInterfaces.isPrimary, true)
			)
		)
		.run();
}

export type { NetworkInterfaceResult, NetworkInterfaceRow, NetworkInterfaceWritableFields };
export {
	activeAssetExists,
	activeZoneExists,
	buildInterfaceValues,
	demoteOtherPrimaries,
	interfaceLabel,
	recordInterfaceEvent,
};

import type { AssetWritableFields, ChangeEventInput } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents } from '../../db/schema/assetImports.ts';
import { LIFECYCLE_DATE_KEYS } from './types.ts';

/**
 * Append an entry to the asset_change_events audit trail. Never throws into the
 * caller's write path — a failure to record history must not roll back a
 * successful mutation, so errors are swallowed after being surfaced to the DB
 * layer's own logging.
 *
 * @param input - The change-event fields (action, actor, asset, diff, summary)
 */
function recordChangeEvent(input: ChangeEventInput): void {
	const db = getDb();
	db.insert(assetChangeEvents)
		.values({
			action: input.action,
			...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
			assetId: input.assetId,
			...(input.changes !== undefined ? { changes: input.changes } : {}),
			entityId: input.assetId,
			entityType: 'asset',
			...(input.importId !== undefined ? { importId: input.importId } : {}),
			...(input.summary !== undefined ? { summary: input.summary } : {}),
		})
		.run();
}

/**
 * Build the concrete insert payload from the writable-field subset.
 *
 * @param input - The writable asset fields to include (undefined fields skipped)
 * @returns A record of column values suitable for insert/update
 */
function buildWriteValues(input: AssetWritableFields): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const assign = <T>(key: keyof AssetWritableFields, value: T | undefined): void => {
		if (value !== undefined) values[key] = value;
	};
	assign('name', input.name?.trim());
	assign('assetType', input.assetType);
	assign('status', input.status);
	assign('criticality', input.criticality);
	assign('description', input.description);
	assign('hostname', input.hostname);
	assign('fqdn', input.fqdn);
	assign('primaryIp', input.primaryIp);
	assign('operatingSystem', input.operatingSystem);
	assign('osVersion', input.osVersion);
	assign('platform', input.platform);
	assign('role', input.role);
	assign('siteId', input.siteId);
	assign('networkZoneId', input.networkZoneId);
	assign('businessOwnerId', input.businessOwnerId);
	assign('technicalOwnerId', input.technicalOwnerId);
	assign('vendorId', input.vendorId);
	assign('parentHostId', input.parentHostId);
	assign('isVirtual', input.isVirtual);
	assign('assetTag', input.assetTag);
	assign('serialNumber', input.serialNumber);
	assign('managementUrl', input.managementUrl);
	assign('documentationUrl', input.documentationUrl);
	assign('supportContact', input.supportContact);
	assign('notes', input.notes);
	// Lifecycle timestamps arrive as ISO strings (or null to clear); coerce to
	// Date so Drizzle stores them in the timestamp columns.
	for (const key of LIFECYCLE_DATE_KEYS) {
		const value = input[key];
		if (value !== undefined) {
			values[key] = value === null ? null : new Date(value);
		}
	}
	return values;
}

export { buildWriteValues, recordChangeEvent };

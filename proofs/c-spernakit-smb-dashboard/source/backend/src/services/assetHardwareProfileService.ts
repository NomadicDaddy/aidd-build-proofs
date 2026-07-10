import { eq } from 'drizzle-orm';

import { getDb } from '../db/index.ts';
import { assetChangeEvents } from '../db/schema/assetImports.ts';
import { assetHardwareProfiles } from '../db/schema/assetProfiles.ts';

type HardwareProfileRow = typeof assetHardwareProfiles.$inferSelect;

/**
 * Fields a client may set on an asset's hardware profile. Covers the shared
 * CPU/memory/storage facts, VM-specific fields (guest OS, vCPU, tools status,
 * snapshot notes, cluster), and physical-host fields (chassis, form factor,
 * host role, totals). Every field is optional; `null` clears the column and
 * `undefined` leaves it untouched.
 */
interface HardwareProfileWritableFields {
	chassisModel?: null | string;
	clusterName?: null | string;
	cpuCores?: null | number;
	cpuModel?: null | string;
	cpuSockets?: null | number;
	cpuThreads?: null | number;
	formFactor?: null | string;
	guestOs?: null | string;
	hardwareModel?: null | string;
	hostRole?: null | string;
	hypervisor?: null | string;
	notes?: null | string;
	ramMb?: null | number;
	snapshotNotes?: null | string;
	totalStorageGb?: null | number;
	vcpuCount?: null | number;
	vmToolsStatus?: null | string;
}

/** Column keys the caller controls, used to build insert/update payloads. */
const WRITABLE_KEYS: (keyof HardwareProfileWritableFields)[] = [
	'chassisModel',
	'clusterName',
	'cpuCores',
	'cpuModel',
	'cpuSockets',
	'cpuThreads',
	'formFactor',
	'guestOs',
	'hardwareModel',
	'hostRole',
	'hypervisor',
	'notes',
	'ramMb',
	'snapshotNotes',
	'totalStorageGb',
	'vcpuCount',
	'vmToolsStatus',
];

/** Fields for a hardware-profile change-event audit entry. */
interface ProfileChangeEventInput {
	action: 'create' | 'update';
	actorId: number;
	assetId: number;
	changes: Record<string, unknown>;
	profileId: number;
	summary: string;
}

/**
 * Append an entry to the asset_change_events audit trail for a hardware-profile
 * write. Mirrors assetService.recordChangeEvent but records the sub-entity type
 * so the asset history can label it distinctly.
 *
 * @param input - The change-event fields (action, actor, asset, profile, diff, summary)
 */
function recordProfileEvent(input: ProfileChangeEventInput): void {
	const db = getDb();
	db.insert(assetChangeEvents)
		.values({
			action: input.action,
			actorId: input.actorId,
			assetId: input.assetId,
			changes: input.changes,
			entityId: input.profileId,
			entityType: 'asset_hardware_profile',
			summary: input.summary,
		})
		.run();
}

/**
 * Get the hardware profile for an asset.
 *
 * @param assetId - Asset id whose profile to load
 * @returns The profile row, or null when the asset has no profile yet
 */
function getHardwareProfile(assetId: number): HardwareProfileRow | null {
	const db = getDb();
	return (
		db
			.select()
			.from(assetHardwareProfiles)
			.where(eq(assetHardwareProfiles.assetId, assetId))
			.get() ?? null
	);
}

/**
 * Build the concrete column payload from the writable-field subset.
 *
 * @param input - The writable profile fields to include (undefined fields skipped)
 * @returns A record of column values suitable for insert/update
 */
function buildProfileValues(input: HardwareProfileWritableFields): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key of WRITABLE_KEYS) {
		const value = input[key];
		if (value !== undefined) values[key] = value;
	}
	return values;
}

/**
 * Create or update (upsert) an asset's hardware profile and record a change
 * event on the asset's audit trail. The profile is one-to-one with the asset:
 * a first write inserts the row, subsequent writes patch it in place.
 *
 * @param assetId - Asset id the profile belongs to
 * @param input - Profile fields to set (undefined fields are skipped)
 * @param actorId - Id of the user performing the action
 * @returns The persisted profile row
 */
function upsertHardwareProfile(
	assetId: number,
	input: HardwareProfileWritableFields,
	actorId: number
): HardwareProfileRow {
	const db = getDb();

	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(assetHardwareProfiles)
			.where(eq(assetHardwareProfiles.assetId, assetId))
			.get();

		const values = buildProfileValues(input);

		if (!existing) {
			tx.insert(assetHardwareProfiles)
				.values({
					...values,
					assetId,
					createdBy: actorId,
					updatedBy: actorId,
				} as typeof assetHardwareProfiles.$inferInsert)
				.run();
			const created = tx
				.select()
				.from(assetHardwareProfiles)
				.where(eq(assetHardwareProfiles.assetId, assetId))
				.get();
			if (!created) {
				throw new Error('Failed to retrieve hardware profile after creation');
			}
			recordProfileEvent({
				action: 'create',
				actorId,
				assetId,
				changes: { after: values },
				profileId: created.id,
				summary: 'Created hardware profile',
			});
			return created;
		}

		if (Object.keys(values).length > 0) {
			tx.update(assetHardwareProfiles)
				.set({ ...values, updatedAt: new Date(), updatedBy: actorId })
				.where(eq(assetHardwareProfiles.assetId, assetId))
				.run();
		}

		const updated = tx
			.select()
			.from(assetHardwareProfiles)
			.where(eq(assetHardwareProfiles.assetId, assetId))
			.get();
		if (!updated) {
			throw new Error('Failed to retrieve hardware profile after update');
		}

		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			before[key] = (existing as Record<string, unknown>)[key];
		}
		recordProfileEvent({
			action: 'update',
			actorId,
			assetId,
			changes: { after: values, before },
			profileId: updated.id,
			summary: 'Updated hardware profile',
		});
		return updated;
	});
}

export type { HardwareProfileRow, HardwareProfileWritableFields };
export { getHardwareProfile, upsertHardwareProfile };

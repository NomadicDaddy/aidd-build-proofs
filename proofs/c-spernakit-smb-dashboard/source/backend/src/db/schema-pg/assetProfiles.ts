import { relations } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

import { assets } from './assets.ts';
import { networkZones } from './infrastructure.ts';
import { users } from './users.ts';

/**
 * Asset hardware profiles — CPU, memory, virtualization, and chassis facts for a
 * server, VM, or host. One-to-one with an asset (unique assetId).
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade' — the profile belongs to its asset.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetHardwareProfiles = pgTable(
	'asset_hardware_profiles',
	{
		assetId: integer('asset_id').notNull(),
		chassisModel: text('chassis_model'),
		clusterName: text('cluster_name'),
		cpuCores: integer('cpu_cores'),
		cpuModel: text('cpu_model'),
		cpuSockets: integer('cpu_sockets'),
		cpuThreads: integer('cpu_threads'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		formFactor: text('form_factor'),
		guestOs: text('guest_os'),
		hardwareModel: text('hardware_model'),
		hostRole: text('host_role'),
		hypervisor: text('hypervisor'),
		id: serial('id').primaryKey(),
		notes: text('notes'),
		ramMb: integer('ram_mb'),
		snapshotNotes: text('snapshot_notes'),
		totalStorageGb: integer('total_storage_gb'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		vcpuCount: integer('vcpu_count'),
		vmToolsStatus: text('vm_tools_status'),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_hardware_profiles_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_hardware_profiles_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_hardware_profiles_updated_by_users',
		}).onDelete('set null'),
		uniqueIndex('idx_asset_hardware_profiles_asset_id').on(table.assetId),
	]
);

/**
 * Asset network interfaces — addressing data (MAC, IP, subnet, VLAN, DNS) per NIC,
 * optionally tied to a network zone.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade'.
 * - networkZoneId: onDelete 'set null'.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetNetworkInterfaces = pgTable(
	'asset_network_interfaces',
	{
		assetId: integer('asset_id').notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		dnsName: text('dns_name'),
		gateway: text('gateway'),
		id: serial('id').primaryKey(),
		ipAddress: text('ip_address'),
		isPrimary: boolean('is_primary').notNull().default(false),
		macAddress: text('mac_address'),
		name: text('name'),
		networkZoneId: integer('network_zone_id'),
		notes: text('notes'),
		subnetMask: text('subnet_mask'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		vlanId: integer('vlan_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_network_interfaces_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.networkZoneId],
			foreignColumns: [networkZones.id],
			name: 'fk_asset_network_interfaces_network_zone_id_network_zones',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_network_interfaces_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_network_interfaces_updated_by_users',
		}).onDelete('set null'),
		index('idx_asset_network_interfaces_asset_id').on(table.assetId),
		index('idx_asset_network_interfaces_ip_address').on(table.ipAddress),
		index('idx_asset_network_interfaces_network_zone_id').on(table.networkZoneId),
	]
);

/**
 * Asset storage allocations — capacity a consuming asset draws from a storage pool
 * or volume. storagePoolAssetId references the asset acting as the pool/appliance.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade' — allocation belongs to the consuming asset.
 * - storagePoolAssetId: onDelete 'set null' — the pool reference clears if the pool asset is removed.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetStorageAllocations = pgTable(
	'asset_storage_allocations',
	{
		assetId: integer('asset_id').notNull(),
		capacityGb: integer('capacity_gb'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: serial('id').primaryKey(),
		mountPoint: text('mount_point'),
		name: text('name'),
		notes: text('notes'),
		storagePoolAssetId: integer('storage_pool_asset_id'),
		storageType: text('storage_type'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		usedGb: integer('used_gb'),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_storage_allocations_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.storagePoolAssetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_storage_allocations_storage_pool_asset_id_assets',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_storage_allocations_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_storage_allocations_updated_by_users',
		}).onDelete('set null'),
		index('idx_asset_storage_allocations_asset_id').on(table.assetId),
		index('idx_asset_storage_allocations_storage_pool_asset_id').on(table.storagePoolAssetId),
	]
);

const assetHardwareProfilesRelations = relations(assetHardwareProfiles, ({ one }) => ({
	asset: one(assets, { fields: [assetHardwareProfiles.assetId], references: [assets.id] }),
}));

const assetNetworkInterfacesRelations = relations(assetNetworkInterfaces, ({ one }) => ({
	asset: one(assets, { fields: [assetNetworkInterfaces.assetId], references: [assets.id] }),
	networkZone: one(networkZones, {
		fields: [assetNetworkInterfaces.networkZoneId],
		references: [networkZones.id],
	}),
}));

const assetStorageAllocationsRelations = relations(assetStorageAllocations, ({ one }) => ({
	asset: one(assets, {
		fields: [assetStorageAllocations.assetId],
		references: [assets.id],
		relationName: 'storageConsumer',
	}),
	storagePool: one(assets, {
		fields: [assetStorageAllocations.storagePoolAssetId],
		references: [assets.id],
		relationName: 'storagePool',
	}),
}));

export {
	assetHardwareProfiles,
	assetHardwareProfilesRelations,
	assetNetworkInterfaces,
	assetNetworkInterfacesRelations,
	assetStorageAllocations,
	assetStorageAllocationsRelations,
};

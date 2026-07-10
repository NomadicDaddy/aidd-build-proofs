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
import {
	ASSET_ALIAS_TYPES,
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
} from 'spernakit-shared';

import { networkZones, owners, sites, vendors } from './infrastructure.ts';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

const ASSET_TYPE_VALUES = ASSET_TYPES as unknown as readonly [string, ...string[]];
const ASSET_STATUS_VALUES = ASSET_STATUSES as unknown as readonly [string, ...string[]];
const CRITICALITY_VALUES = CRITICALITY_LEVELS as unknown as readonly [string, ...string[]];
const ALIAS_TYPE_VALUES = ASSET_ALIAS_TYPES as unknown as readonly [string, ...string[]];

/**
 * Assets — the central inventory record for every tracked infrastructure item.
 *
 * Table features:
 * - Soft delete: isDeleted, deletedAt, deletedBy for recoverable deletion + archive/restore flows
 * - Audit fields: createdBy, updatedBy
 * - Optional workspace scoping (workspaceId) for multi-inventory deployments
 *
 * Foreign key cascade behavior:
 * - siteId/networkZoneId/businessOwnerId/technicalOwnerId/vendorId: onDelete 'set null' — an asset
 *   survives deletion of its site, zone, owner, or vendor (the reference simply clears).
 * - parentHostId: self-reference, onDelete 'set null' — deleting a host orphans its VMs rather than
 *   cascading their removal; relationship records carry the richer topology.
 * - workspaceId: onDelete 'set null' — inventory data is preserved even if a workspace is removed.
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const assets = pgTable(
	'assets',
	{
		assetTag: text('asset_tag'),
		assetType: text('asset_type', { enum: ASSET_TYPE_VALUES }).notNull(),
		businessOwnerId: integer('business_owner_id'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		criticality: text('criticality', { enum: CRITICALITY_VALUES }).notNull().default('unknown'),
		decommissionedAt: timestamp('decommissioned_at', { mode: 'date' }),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		description: text('description'),
		documentationUrl: text('documentation_url'),
		fqdn: text('fqdn'),
		hostname: text('hostname'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		isVirtual: boolean('is_virtual').notNull().default(false),
		lastVerifiedAt: timestamp('last_verified_at', { mode: 'date' }),
		managementUrl: text('management_url'),
		name: text('name').notNull(),
		networkZoneId: integer('network_zone_id'),
		notes: text('notes'),
		operatingSystem: text('operating_system'),
		osVersion: text('os_version'),
		parentHostId: integer('parent_host_id'),
		plannedReplacementAt: timestamp('planned_replacement_at', { mode: 'date' }),
		platform: text('platform'),
		primaryIp: text('primary_ip'),
		purchaseDate: timestamp('purchase_date', { mode: 'date' }),
		role: text('role'),
		serialNumber: text('serial_number'),
		siteId: integer('site_id'),
		status: text('status', { enum: ASSET_STATUS_VALUES }).notNull().default('active'),
		supportContact: text('support_contact'),
		supportEndsAt: timestamp('support_ends_at', { mode: 'date' }),
		technicalOwnerId: integer('technical_owner_id'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		vendorId: integer('vendor_id'),
		warrantyExpiresAt: timestamp('warranty_expires_at', { mode: 'date' }),
		workspaceId: integer('workspace_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: 'fk_assets_site_id_sites',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.networkZoneId],
			foreignColumns: [networkZones.id],
			name: 'fk_assets_network_zone_id_network_zones',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.businessOwnerId],
			foreignColumns: [owners.id],
			name: 'fk_assets_business_owner_id_owners',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.technicalOwnerId],
			foreignColumns: [owners.id],
			name: 'fk_assets_technical_owner_id_owners',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: 'fk_assets_vendor_id_vendors',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.parentHostId],
			foreignColumns: [table.id],
			name: 'fk_assets_parent_host_id_assets',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: 'fk_assets_workspace_id_workspaces',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_assets_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_assets_updated_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_assets_deleted_by_users',
		}).onDelete('set null'),
		index('idx_assets_asset_type').on(table.assetType),
		index('idx_assets_status').on(table.status),
		index('idx_assets_criticality').on(table.criticality),
		index('idx_assets_site_id').on(table.siteId),
		index('idx_assets_parent_host_id').on(table.parentHostId),
		index('idx_assets_workspace_id').on(table.workspaceId),
		index('idx_assets_hostname').on(table.hostname),
		index('idx_assets_name').on(table.name),
		index('idx_assets_is_deleted').on(table.isDeleted),
	]
);

/**
 * Asset aliases — alternate identities (hostnames, FQDNs, IPs, serials, asset tags)
 * used for search and import duplicate detection.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade' — aliases belong to their asset and are removed with it.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetAliases = pgTable(
	'asset_aliases',
	{
		aliasType: text('alias_type', { enum: ALIAS_TYPE_VALUES }).notNull().default('other'),
		assetId: integer('asset_id').notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: serial('id').primaryKey(),
		notes: text('notes'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		value: text('value').notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_aliases_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_aliases_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_aliases_updated_by_users',
		}).onDelete('set null'),
		index('idx_asset_aliases_asset_id').on(table.assetId),
		index('idx_asset_aliases_value').on(table.value),
		index('idx_asset_aliases_alias_type').on(table.aliasType),
	]
);

/**
 * Asset tags — free-form labels for grouping and bulk operations.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade'.
 * - createdBy: onDelete 'set null'.
 */
const assetTags = pgTable(
	'asset_tags',
	{
		assetId: integer('asset_id').notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: serial('id').primaryKey(),
		label: text('label').notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_tags_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_tags_created_by_users',
		}).onDelete('set null'),
		index('idx_asset_tags_asset_id').on(table.assetId),
		index('idx_asset_tags_label').on(table.label),
		uniqueIndex('idx_asset_tags_asset_id_label').on(table.assetId, table.label),
	]
);

const assetsRelations = relations(assets, ({ many, one }) => ({
	aliases: many(assetAliases),
	businessOwner: one(owners, {
		fields: [assets.businessOwnerId],
		references: [owners.id],
		relationName: 'assetBusinessOwner',
	}),
	networkZone: one(networkZones, {
		fields: [assets.networkZoneId],
		references: [networkZones.id],
	}),
	parentHost: one(assets, {
		fields: [assets.parentHostId],
		references: [assets.id],
		relationName: 'assetParentHost',
	}),
	site: one(sites, { fields: [assets.siteId], references: [sites.id] }),
	tags: many(assetTags),
	technicalOwner: one(owners, {
		fields: [assets.technicalOwnerId],
		references: [owners.id],
		relationName: 'assetTechnicalOwner',
	}),
	vendor: one(vendors, { fields: [assets.vendorId], references: [vendors.id] }),
}));

const assetAliasesRelations = relations(assetAliases, ({ one }) => ({
	asset: one(assets, { fields: [assetAliases.assetId], references: [assets.id] }),
}));

const assetTagsRelations = relations(assetTags, ({ one }) => ({
	asset: one(assets, { fields: [assetTags.assetId], references: [assets.id] }),
}));

export {
	assetAliases,
	assetAliasesRelations,
	assets,
	assetsRelations,
	assetTags,
	assetTagsRelations,
};

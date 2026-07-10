import {
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { CRITICALITY_LEVELS } from 'spernakit-shared';

import { assets } from './assets.ts';
import { owners, vendors } from './infrastructure.ts';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

const CRITICALITY_VALUES = CRITICALITY_LEVELS as unknown as readonly [string, ...string[]];

/**
 * Service catalog — business and technical services (AD, DNS, DHCP, file, backup, …)
 * with ownership, criticality, and purpose. Backing assets are linked via asset_services.
 *
 * Table features:
 * - Soft delete + audit fields
 * - Optional workspace scoping (workspaceId)
 *
 * Foreign key cascade behavior:
 * - ownerId/vendorId: onDelete 'set null'.
 * - workspaceId: onDelete 'set null'.
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const serviceCatalog = sqliteTable(
	'service_catalog',
	{
		category: text('category'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		criticality: text('criticality', { enum: CRITICALITY_VALUES }).notNull().default('unknown'),
		deletedAt: integer('deleted_at', { mode: 'timestamp' }),
		deletedBy: integer('deleted_by'),
		description: text('description'),
		expectedAvailability: text('expected_availability'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
		name: text('name').notNull(),
		notes: text('notes'),
		ownerId: integer('owner_id'),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		vendorId: integer('vendor_id'),
		workspaceId: integer('workspace_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owners.id],
			name: 'fk_service_catalog_owner_id_owners',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: 'fk_service_catalog_vendor_id_vendors',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: 'fk_service_catalog_workspace_id_workspaces',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_service_catalog_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_service_catalog_updated_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_service_catalog_deleted_by_users',
		}).onDelete('set null'),
		index('idx_service_catalog_name').on(table.name),
		index('idx_service_catalog_category').on(table.category),
		index('idx_service_catalog_workspace_id').on(table.workspaceId),
		index('idx_service_catalog_is_deleted').on(table.isDeleted),
	]
);

/**
 * Asset services — assignment of a catalog service to a backing asset, with the
 * role the asset plays for that service.
 *
 * Foreign key cascade behavior:
 * - assetId/serviceId: onDelete 'cascade' — the assignment is removed with either side.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetServices = sqliteTable(
	'asset_services',
	{
		assetId: integer('asset_id').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
		notes: text('notes'),
		role: text('role'),
		serviceId: integer('service_id').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_services_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.serviceId],
			foreignColumns: [serviceCatalog.id],
			name: 'fk_asset_services_service_id_service_catalog',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_services_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_services_updated_by_users',
		}).onDelete('set null'),
		index('idx_asset_services_asset_id').on(table.assetId),
		index('idx_asset_services_service_id').on(table.serviceId),
		uniqueIndex('idx_asset_services_asset_id_service_id').on(table.assetId, table.serviceId),
	]
);

export { assetServices, serviceCatalog };

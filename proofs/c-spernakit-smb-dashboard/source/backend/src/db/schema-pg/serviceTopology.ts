import { foreignKey, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import {
	PORT_EXPOSURE_LEVELS,
	PORT_PROTOCOLS,
	PORT_REVIEW_STATES,
	PORT_SOURCES,
} from 'spernakit-shared';

import { assets } from './assets.ts';
import { serviceCatalog } from './serviceCatalog.ts';
import { users } from './users.ts';

const PORT_PROTOCOL_VALUES = PORT_PROTOCOLS as unknown as readonly [string, ...string[]];
const PORT_EXPOSURE_VALUES = PORT_EXPOSURE_LEVELS as unknown as readonly [string, ...string[]];
const PORT_SOURCE_VALUES = PORT_SOURCES as unknown as readonly [string, ...string[]];
const PORT_REVIEW_VALUES = PORT_REVIEW_STATES as unknown as readonly [string, ...string[]];

/**
 * Service dependencies — a catalog service depends on another service and/or an
 * infrastructure asset. Exactly one of dependsOnServiceId / dependsOnAssetId is set.
 *
 * Foreign key cascade behavior:
 * - serviceId: onDelete 'cascade' — dependency belongs to the dependent service.
 * - dependsOnServiceId/dependsOnAssetId: onDelete 'cascade' — the edge disappears with its target.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const serviceDependencies = pgTable(
	'service_dependencies',
	{
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		dependencyType: text('dependency_type'),
		dependsOnAssetId: integer('depends_on_asset_id'),
		dependsOnServiceId: integer('depends_on_service_id'),
		id: serial('id').primaryKey(),
		notes: text('notes'),
		serviceId: integer('service_id').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
	},
	(table) => [
		foreignKey({
			columns: [table.serviceId],
			foreignColumns: [serviceCatalog.id],
			name: 'fk_service_dependencies_service_id_service_catalog',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.dependsOnServiceId],
			foreignColumns: [serviceCatalog.id],
			name: 'fk_service_dependencies_depends_on_service_id_service_catalog',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.dependsOnAssetId],
			foreignColumns: [assets.id],
			name: 'fk_service_dependencies_depends_on_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_service_dependencies_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_service_dependencies_updated_by_users',
		}).onDelete('set null'),
		index('idx_service_dependencies_service_id').on(table.serviceId),
		index('idx_service_dependencies_depends_on_service_id').on(table.dependsOnServiceId),
		index('idx_service_dependencies_depends_on_asset_id').on(table.dependsOnAssetId),
	]
);

/**
 * Asset ports — expected (documented) and observed (scanned) open ports on an asset,
 * optionally attributed to a catalog service. Review state distinguishes documentation
 * from imported observations that still need triage.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'cascade'.
 * - serviceId: onDelete 'set null' — the port record survives service removal.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const assetPorts = pgTable(
	'asset_ports',
	{
		assetId: integer('asset_id').notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		exposureLevel: text('exposure_level', { enum: PORT_EXPOSURE_VALUES })
			.notNull()
			.default('unknown'),
		id: serial('id').primaryKey(),
		notes: text('notes'),
		portNumber: integer('port_number').notNull(),
		protocol: text('protocol', { enum: PORT_PROTOCOL_VALUES }).notNull().default('tcp'),
		reviewState: text('review_state', { enum: PORT_REVIEW_VALUES })
			.notNull()
			.default('expected'),
		scope: text('scope'),
		serviceId: integer('service_id'),
		serviceName: text('service_name'),
		source: text('source', { enum: PORT_SOURCE_VALUES }).notNull().default('documented'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		verifiedAt: timestamp('verified_at', { mode: 'date' }),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_ports_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.serviceId],
			foreignColumns: [serviceCatalog.id],
			name: 'fk_asset_ports_service_id_service_catalog',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_ports_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_ports_updated_by_users',
		}).onDelete('set null'),
		index('idx_asset_ports_asset_id').on(table.assetId),
		index('idx_asset_ports_service_id').on(table.serviceId),
		index('idx_asset_ports_port_number').on(table.portNumber),
		index('idx_asset_ports_review_state').on(table.reviewState),
	]
);

export { assetPorts, serviceDependencies };

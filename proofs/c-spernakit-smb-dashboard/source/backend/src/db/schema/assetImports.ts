import { relations } from 'drizzle-orm';
import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
	CHANGE_EVENT_ACTIONS,
	IMPORT_KINDS,
	IMPORT_ROW_STATUSES,
	IMPORT_STATUSES,
} from 'spernakit-shared';

import { assets } from './assets.ts';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

const IMPORT_KIND_VALUES = IMPORT_KINDS as unknown as readonly [string, ...string[]];
const IMPORT_STATUS_VALUES = IMPORT_STATUSES as unknown as readonly [string, ...string[]];
const IMPORT_ROW_STATUS_VALUES = IMPORT_ROW_STATUSES as unknown as readonly [string, ...string[]];
const CHANGE_EVENT_ACTION_VALUES = CHANGE_EVENT_ACTIONS as unknown as readonly [
	string,
	...string[],
];

/**
 * Imports — a staged CSV/JSON import batch with source, counts, and lifecycle status.
 * Rows are reviewed (import_rows) before changes are applied to the inventory.
 *
 * Foreign key cascade behavior:
 * - importedBy: onDelete 'set null' — the import record survives deletion of the importing user.
 * - workspaceId: onDelete 'set null'.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const imports = sqliteTable(
	'imports',
	{
		acceptedCount: integer('accepted_count').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		importedBy: integer('imported_by'),
		kind: text('kind', { enum: IMPORT_KIND_VALUES }).notNull(),
		notes: text('notes'),
		rejectedCount: integer('rejected_count').notNull().default(0),
		rowCount: integer('row_count').notNull().default(0),
		source: text('source'),
		status: text('status', { enum: IMPORT_STATUS_VALUES }).notNull().default('pending'),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		warningCount: integer('warning_count').notNull().default(0),
		workspaceId: integer('workspace_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.importedBy],
			foreignColumns: [users.id],
			name: 'fk_imports_imported_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: 'fk_imports_workspace_id_workspaces',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_imports_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_imports_updated_by_users',
		}).onDelete('set null'),
		index('idx_imports_status').on(table.status),
		index('idx_imports_kind').on(table.kind),
		index('idx_imports_workspace_id').on(table.workspaceId),
	]
);

/**
 * Import rows — one staged record per source row, holding raw and parsed payloads,
 * a review disposition, and an optional link to the affected asset once applied.
 *
 * Foreign key cascade behavior:
 * - importId: onDelete 'cascade' — rows belong to their import batch.
 * - targetAssetId: onDelete 'set null' — the row's audit value survives asset deletion.
 * - createdBy/updatedBy: onDelete 'set null'.
 */
const importRows = sqliteTable(
	'import_rows',
	{
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		importId: integer('import_id').notNull(),
		message: text('message'),
		parsedData: text('parsed_data', { mode: 'json' }).$type<Record<string, unknown>>(),
		rawData: text('raw_data', { mode: 'json' }).$type<Record<string, unknown>>(),
		rowNumber: integer('row_number'),
		status: text('status', { enum: IMPORT_ROW_STATUS_VALUES }).notNull().default('pending'),
		targetAssetId: integer('target_asset_id'),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
	},
	(table) => [
		foreignKey({
			columns: [table.importId],
			foreignColumns: [imports.id],
			name: 'fk_import_rows_import_id_imports',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.targetAssetId],
			foreignColumns: [assets.id],
			name: 'fk_import_rows_target_asset_id_assets',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_import_rows_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_import_rows_updated_by_users',
		}).onDelete('set null'),
		index('idx_import_rows_import_id').on(table.importId),
		index('idx_import_rows_status').on(table.status),
		index('idx_import_rows_target_asset_id').on(table.targetAssetId),
	]
);

/**
 * Asset change events — append-only audit trail for domain writes (create, update,
 * delete, restore, archive, import). Records actor, action, a human summary, and a
 * JSON before/after diff. Never soft-deleted; kept for history even if the asset is
 * removed.
 *
 * Foreign key cascade behavior:
 * - assetId: onDelete 'set null' — history survives deletion of the asset it describes.
 * - actorId: onDelete 'set null'.
 * - importId: onDelete 'set null' — links import-driven changes without blocking import cleanup.
 */
const assetChangeEvents = sqliteTable(
	'asset_change_events',
	{
		action: text('action', { enum: CHANGE_EVENT_ACTION_VALUES }).notNull(),
		actorId: integer('actor_id'),
		assetId: integer('asset_id'),
		changes: text('changes', { mode: 'json' }).$type<Record<string, unknown>>(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		entityId: integer('entity_id'),
		entityType: text('entity_type').notNull(),
		id: integer('id').primaryKey({ autoIncrement: true }),
		importId: integer('import_id'),
		summary: text('summary'),
	},
	(table) => [
		foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_change_events_asset_id_assets',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.actorId],
			foreignColumns: [users.id],
			name: 'fk_asset_change_events_actor_id_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [imports.id],
			name: 'fk_asset_change_events_import_id_imports',
		}).onDelete('set null'),
		index('idx_asset_change_events_asset_id').on(table.assetId),
		index('idx_asset_change_events_entity_type').on(table.entityType),
		index('idx_asset_change_events_created_at').on(table.createdAt),
		index('idx_asset_change_events_import_id').on(table.importId),
	]
);

const importsRelations = relations(imports, ({ many }) => ({
	rows: many(importRows),
}));

const importRowsRelations = relations(importRows, ({ one }) => ({
	import: one(imports, { fields: [importRows.importId], references: [imports.id] }),
	targetAsset: one(assets, { fields: [importRows.targetAssetId], references: [assets.id] }),
}));

const assetChangeEventsRelations = relations(assetChangeEvents, ({ one }) => ({
	asset: one(assets, { fields: [assetChangeEvents.assetId], references: [assets.id] }),
	import: one(imports, { fields: [assetChangeEvents.importId], references: [imports.id] }),
}));

export {
	assetChangeEvents,
	assetChangeEventsRelations,
	importRows,
	importRowsRelations,
	imports,
	importsRelations,
};

import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

/**
 * Saved inventory views table.
 *
 * Stores named, reusable asset-inventory filter presets so users can answer
 * recurring infrastructure questions ("which assets are VMs?", "what ports are
 * exposed to the internet?") without re-entering the same filters each time.
 *
 * Each view belongs to a user and is scoped to an optional workspace so the
 * workspace switcher filters the saved-view list per tenant, mirroring the
 * dashboard_configs pattern.
 *
 * The `filters` column holds the inventory filter state as a JSON map of URL
 * filter keys to string values (e.g. `{ "type": "virtual_machine" }`). Loading
 * a view re-applies these to the inventory page's URL parameters.
 *
 * Table features:
 * - Soft delete: isDeleted, deletedAt, deletedBy for recoverable deletion
 * - Audit fields: createdBy, updatedBy for tracking who created/modified views
 *
 * Design note — workspaceId nullability:
 * workspaceId is nullable so SYSOP-level global views can exist without a
 * workspace. For regular users the route layer always supplies the active
 * X-Workspace-ID header.
 *
 * Foreign key cascade behavior:
 * - userId: onDelete 'cascade' — views are deleted when the owning user is deleted.
 * - workspaceId: onDelete 'cascade' — views are deleted when their workspace is deleted.
 * - createdBy / updatedBy / deletedBy: onDelete 'set null' — view records persist
 *   when the acting user is deleted.
 */
const savedViews = sqliteTable(
	'saved_views',
	{
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: integer('deleted_at', { mode: 'timestamp' }),
		deletedBy: integer('deleted_by'),
		filters: text('filters', { mode: 'json' }).$type<Record<string, string>>().notNull(),
		id: integer('id').primaryKey({ autoIncrement: true }),
		isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
		name: text('name').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		userId: integer('user_id').notNull(),
		workspaceId: integer('workspace_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_saved_views_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_saved_views_deleted_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_saved_views_updated_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'fk_saved_views_user_id_users',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: 'fk_saved_views_workspace_id_workspaces',
		}).onDelete('cascade'),
		index('idx_saved_views_user_id').on(table.userId),
		index('idx_saved_views_is_deleted').on(table.isDeleted),
		index('idx_saved_views_user_id_is_deleted').on(table.userId, table.isDeleted),
		index('idx_saved_views_workspace_id').on(table.workspaceId),
		index('idx_saved_views_workspace_id_user_id').on(table.workspaceId, table.userId),
	]
);

export { savedViews };

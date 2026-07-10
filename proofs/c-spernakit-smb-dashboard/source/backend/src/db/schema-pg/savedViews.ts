import {
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

/**
 * Saved inventory views table (PostgreSQL variant).
 *
 * This schema maintains logical parity with the SQLite variant
 * (../schema/savedViews.ts). Type mappings differ by dialect:
 * - SQLite: integer with mode: 'timestamp'/'boolean', text with mode: 'json'
 * - PostgreSQL: native timestamp/boolean types and jsonb
 *
 * Both schemas MUST have identical logical fields. If you add a field to one,
 * add the equivalent to the other.
 *
 * @see ../schema/savedViews.ts for SQLite variant and full documentation
 */
const savedViews = pgTable(
	'saved_views',
	{
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		filters: jsonb('filters').$type<Record<string, string>>().notNull(),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		name: text('name').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' })
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

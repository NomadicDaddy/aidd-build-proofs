import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { BUG_REPORT_KINDS, BUG_REPORT_STATUSES } from 'spernakit-shared';

import { users } from './users.ts';

/**
 * Bug reports table (PostgreSQL variant).
 *
 * @see ../schema/bugReports.ts for SQLite variant and full documentation
 */
const bugReports = pgTable(
	'bug_reports',
	{
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		description: text('description').notNull(),
		email: text('email'),
		id: serial('id').primaryKey(),
		kind: text('kind', { enum: BUG_REPORT_KINDS }).notNull().default('bug'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),
		status: text('status', { enum: BUG_REPORT_STATUSES }).notNull().default('open'),
		title: text('title').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		userId: integer('user_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'fk_bug_reports_user_id_users',
		}).onDelete('set null'),
		index('idx_bug_reports_user_id').on(table.userId),
		index('idx_bug_reports_status').on(table.status),
		index('idx_bug_reports_created_at').on(table.createdAt),
	]
);

export { bugReports };

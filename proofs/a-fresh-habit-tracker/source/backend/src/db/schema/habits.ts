/**
 * Habits table — one row per habit the user is tracking.
 *
 * A habit has a display name, a cadence (daily-only in the MVP), and optional
 * target/notes metadata. `archivedAt` acts as a soft-archive marker so habits
 * can be hidden from the active list without losing their check-in history.
 *
 * Column naming follows the spernakit convention: snake_case in the database,
 * camelCase in the Drizzle/TS field names. Timestamps are stored as Unix epoch
 * integers (Drizzle `mode: 'timestamp'`).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const habits = sqliteTable('habits', {
	archivedAt: integer('archived_at', { mode: 'timestamp' }),
	cadence: text('cadence', { enum: ['daily'] })
		.notNull()
		.default('daily'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	notes: text('notes'),
	target: integer('target'),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;

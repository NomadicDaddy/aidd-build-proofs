/**
 * Check-ins table — one row per (habit, day) marking that the habit was done.
 *
 * `date` is stored as a `YYYY-MM-DD` string (local calendar day) rather than a
 * timestamp so streak math compares whole days without time-zone drift. A
 * unique constraint on (habitId, date) makes duplicate same-day check-ins
 * impossible at the storage layer, and the foreign key cascades so deleting a
 * habit removes its check-ins.
 */
import { foreignKey, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

import { habits } from './habits.ts';

export const checkins = sqliteTable(
	'checkins',
	{
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		date: text('date').notNull(),
		habitId: text('habit_id').notNull(),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
	},
	(table) => [
		unique('unique_checkins_habit_id_date').on(table.habitId, table.date),
		foreignKey({
			columns: [table.habitId],
			foreignColumns: [habits.id],
			name: 'fk_checkins_habits_habit_id',
		}).onDelete('cascade'),
	]
);

export type Checkin = typeof checkins.$inferSelect;
export type NewCheckin = typeof checkins.$inferInsert;

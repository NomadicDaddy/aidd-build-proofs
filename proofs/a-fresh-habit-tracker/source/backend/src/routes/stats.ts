/**
 * Habit statistics route: current streak, longest streak, and 30-day completion
 * rate derived from a habit's check-ins.
 *
 * Mounted under the app's `/api/v1` prefix, so the effective path is
 * `/api/v1/habits/:id/stats`. Returns 404 when the habit does not exist; an
 * empty check-in history yields zero streaks and a zero completion rate.
 */
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

import { getDb } from '../db/index.ts';
import { checkins } from '../db/schema/index.ts';
import { computeHabitStats } from '../services/stats.ts';
import { findHabit } from './habits.ts';

const statsDtoSchema = t.Object({
	completionRate: t.Number(),
	currentStreak: t.Number(),
	longestStreak: t.Number(),
	totalCheckins: t.Number(),
});

/** Route params for `/:id/stats` — a non-empty habit id. */
const statsParams = t.Object({ id: t.String({ minLength: 1 }) });

/** Standard 404 response body shape. */
const notFoundSchema = t.Object({ error: t.String() });

export const statsRoute = new Elysia({ prefix: '/habits' }).get(
	'/:id/stats',
	async ({ params, status }) => {
		if ((await findHabit(params.id)) === null) {
			return status(404, { error: 'Habit not found' });
		}
		const rows = await getDb()
			.select({ date: checkins.date })
			.from(checkins)
			.where(eq(checkins.habitId, params.id));
		return computeHabitStats(rows.map((row) => row.date));
	},
	{
		detail: { tags: ['Stats'] },
		params: statsParams,
		response: {
			200: statsDtoSchema,
			404: notFoundSchema,
		},
	}
);

/**
 * Check-in tracking routes: mark, unmark, and list a habit's completed days.
 *
 * Mounted under the app's `/api/v1` prefix, so the effective paths are
 * `/api/v1/habits/:id/checkins` and `/api/v1/habits/:id/checkins/:date`.
 *
 * A check-in records that a habit was done on a given calendar day (`date` as a
 * `YYYY-MM-DD` string). The unique (habitId, date) constraint makes duplicate
 * same-day check-ins impossible at the storage layer; marking an already-marked
 * day therefore returns 409 rather than creating a second row. Unmarking removes
 * the row and returns 204, or 404 when there was nothing to remove.
 */
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

import { getDb } from '../db/index.ts';
import { checkins, type Checkin } from '../db/schema/index.ts';
import { findHabit } from './habits.ts';

/** Serialized check-in DTO — `createdAt` rendered as an ISO string for callers. */
interface CheckinDto {
	createdAt: string;
	date: string;
	habitId: string;
	id: string;
}

/** Convert a stored check-in row into its JSON-safe DTO. */
function serializeCheckin(checkin: Checkin): CheckinDto {
	return {
		createdAt: checkin.createdAt.toISOString(),
		date: checkin.date,
		habitId: checkin.habitId,
		id: checkin.id,
	};
}

const checkinDtoSchema = t.Object({
	createdAt: t.String(),
	date: t.String(),
	habitId: t.String(),
	id: t.String(),
});

/** A calendar day in `YYYY-MM-DD` form. */
const dateString = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });

const createCheckinBody = t.Object({ date: dateString });

/** Route params for `/:id/checkins` — a non-empty habit id. */
const checkinListParams = t.Object({ id: t.String({ minLength: 1 }) });

/** Route params for `/:id/checkins/:date` — habit id plus the target day. */
const checkinDateParams = t.Object({ date: dateString, id: t.String({ minLength: 1 }) });

/** Standard error response body shape shared by these routes. */
const errorSchema = t.Object({ error: t.String() });

/** Fetch an existing check-in for (habit, date), or `null` when absent. */
async function findCheckin(habitId: string, date: string): Promise<Checkin | null> {
	const [row] = await getDb()
		.select()
		.from(checkins)
		.where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
		.limit(1);
	return row ?? null;
}

export const checkinsRoute = new Elysia({ prefix: '/habits' })
	.get(
		'/:id/checkins',
		async ({ params, status }) => {
			if ((await findHabit(params.id)) === null) {
				return status(404, { error: 'Habit not found' });
			}
			const rows = await getDb()
				.select()
				.from(checkins)
				.where(eq(checkins.habitId, params.id));
			return rows.map(serializeCheckin);
		},
		{
			detail: { tags: ['Check-ins'] },
			params: checkinListParams,
			response: {
				200: t.Array(checkinDtoSchema),
				404: errorSchema,
			},
		}
	)
	.post(
		'/:id/checkins',
		async ({ body, params, status }) => {
			if ((await findHabit(params.id)) === null) {
				return status(404, { error: 'Habit not found' });
			}
			if ((await findCheckin(params.id, body.date)) !== null) {
				return status(409, { error: 'Habit already checked in for this date' });
			}
			const [row] = await getDb()
				.insert(checkins)
				.values({ date: body.date, habitId: params.id })
				.returning();
			return status(201, serializeCheckin(row));
		},
		{
			body: createCheckinBody,
			detail: { tags: ['Check-ins'] },
			params: checkinListParams,
			response: {
				201: checkinDtoSchema,
				404: errorSchema,
				409: errorSchema,
			},
		}
	)
	.delete(
		'/:id/checkins/:date',
		async ({ params, set, status }) => {
			const existing = await findCheckin(params.id, params.date);
			if (existing === null) {
				return status(404, { error: 'Check-in not found' });
			}
			await getDb().delete(checkins).where(eq(checkins.id, existing.id));
			set.status = 204;
		},
		{
			detail: { tags: ['Check-ins'] },
			params: checkinDateParams,
			response: {
				204: t.Void(),
				404: errorSchema,
			},
		}
	);

/**
 * Habit CRUD routes: create, list, fetch, update, and archive habits.
 *
 * Mounted under the app's `/api/v1` prefix, so the effective paths are
 * `/api/v1/habits`, `/api/v1/habits/:id`, and `/api/v1/habits/:id/archive`.
 *
 * Habits are soft-archived via `archivedAt`: the default list excludes archived
 * rows, but they remain fetchable by id so their check-in history is preserved.
 * Every mutation bumps `updatedAt` so callers can detect changes. Handlers that
 * grow past ~30 lines are extracted into named functions below the route table.
 */
import { eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

import { getDb } from '../db/index.ts';
import { habits, type Habit } from '../db/schema/index.ts';

/** Serialized habit DTO — timestamps rendered as ISO strings for JSON callers. */
interface HabitDto {
	archivedAt: null | string;
	cadence: 'daily';
	createdAt: string;
	id: string;
	name: string;
	notes: null | string;
	target: null | number;
	updatedAt: string;
}

/** Convert a stored habit row into its JSON-safe DTO. */
function serializeHabit(habit: Habit): HabitDto {
	return {
		archivedAt: habit.archivedAt ? habit.archivedAt.toISOString() : null,
		cadence: habit.cadence,
		createdAt: habit.createdAt.toISOString(),
		id: habit.id,
		name: habit.name,
		notes: habit.notes,
		target: habit.target,
		updatedAt: habit.updatedAt.toISOString(),
	};
}

/** Fetch a single habit row by id, or `null` when it does not exist. */
async function findHabit(id: string): Promise<Habit | null> {
	const [row] = await getDb().select().from(habits).where(eq(habits.id, id)).limit(1);
	return row ?? null;
}

const habitDtoSchema = t.Object({
	archivedAt: t.Union([t.String(), t.Null()]),
	cadence: t.Literal('daily'),
	createdAt: t.String(),
	id: t.String(),
	name: t.String(),
	notes: t.Union([t.String(), t.Null()]),
	target: t.Union([t.Number(), t.Null()]),
	updatedAt: t.String(),
});

const createHabitBody = t.Object({
	cadence: t.Optional(t.Literal('daily')),
	name: t.String({ minLength: 1 }),
	notes: t.Optional(t.Union([t.String(), t.Null()])),
	target: t.Optional(t.Union([t.Number(), t.Null()])),
});

const updateHabitBody = t.Object({
	name: t.Optional(t.String({ minLength: 1 })),
	notes: t.Optional(t.Union([t.String(), t.Null()])),
	target: t.Optional(t.Union([t.Number(), t.Null()])),
});

/** Route params for the `:id` habit routes — a non-empty id string. */
const habitIdParams = t.Object({ id: t.String({ minLength: 1 }) });

/** Standard 404 response body shape shared by the `:id` routes. */
const notFoundSchema = t.Object({ error: t.String() });

type CreateHabitBody = typeof createHabitBody.static;
type UpdateHabitBody = typeof updateHabitBody.static;

/** Insert a new habit; cadence defaults to daily when omitted. */
async function createHabit(body: CreateHabitBody): Promise<HabitDto> {
	const [row] = await getDb()
		.insert(habits)
		.values({
			cadence: body.cadence ?? 'daily',
			name: body.name,
			notes: body.notes ?? null,
			target: body.target ?? null,
		})
		.returning();
	return serializeHabit(row);
}

/** Apply a partial update to a habit, always bumping `updatedAt`. */
async function updateHabit(id: string, body: UpdateHabitBody): Promise<HabitDto | null> {
	if ((await findHabit(id)) === null) return null;

	const patch: Partial<Habit> = { updatedAt: new Date() };
	if (body.name !== undefined) patch.name = body.name;
	if (body.notes !== undefined) patch.notes = body.notes;
	if (body.target !== undefined) patch.target = body.target;

	const [row] = await getDb().update(habits).set(patch).where(eq(habits.id, id)).returning();
	return serializeHabit(row);
}

/** Mark a habit archived (idempotent-ish: re-archiving refreshes the timestamp). */
async function archiveHabit(id: string): Promise<HabitDto | null> {
	if ((await findHabit(id)) === null) return null;

	const now = new Date();
	const [row] = await getDb()
		.update(habits)
		.set({ archivedAt: now, updatedAt: now })
		.where(eq(habits.id, id))
		.returning();
	return serializeHabit(row);
}

export const habitsRoute = new Elysia({ prefix: '/habits' })
	.get(
		'/',
		async () => {
			const rows = await getDb().select().from(habits).where(isNull(habits.archivedAt));
			return rows.map(serializeHabit);
		},
		{ detail: { tags: ['Habits'] }, response: t.Array(habitDtoSchema) }
	)
	.post(
		'/',
		async ({ body, set }) => {
			set.status = 201;
			return createHabit(body);
		},
		{ body: createHabitBody, detail: { tags: ['Habits'] }, response: { 201: habitDtoSchema } }
	)
	.get(
		'/:id',
		async ({ params, status }) => {
			const row = await findHabit(params.id);
			if (row === null) return status(404, { error: 'Habit not found' });
			return serializeHabit(row);
		},
		{
			detail: { tags: ['Habits'] },
			params: habitIdParams,
			response: {
				200: habitDtoSchema,
				404: notFoundSchema,
			},
		}
	)
	.patch(
		'/:id',
		async ({ body, params, status }) => {
			const dto = await updateHabit(params.id, body);
			if (dto === null) return status(404, { error: 'Habit not found' });
			return dto;
		},
		{
			body: updateHabitBody,
			detail: { tags: ['Habits'] },
			params: habitIdParams,
			response: {
				200: habitDtoSchema,
				404: notFoundSchema,
			},
		}
	)
	.post(
		'/:id/archive',
		async ({ params, status }) => {
			const dto = await archiveHabit(params.id);
			if (dto === null) return status(404, { error: 'Habit not found' });
			return dto;
		},
		{
			detail: { tags: ['Habits'] },
			params: habitIdParams,
			response: {
				200: habitDtoSchema,
				404: notFoundSchema,
			},
		}
	);

export { findHabit, serializeHabit, type HabitDto };

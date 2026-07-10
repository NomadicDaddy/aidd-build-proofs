/**
 * Habits API module — thin functions over the `/api/v1/habits` routes. These
 * are transport-only; caching and invalidation live in the query hooks.
 */
import { apiRequest } from './client';
import { type CreateHabitInput, type Habit, type UpdateHabitInput } from './types';

/** Soft-archive a habit (it stays fetchable by id). */
export function archiveHabit(id: string): Promise<Habit> {
	return apiRequest<Habit>(`/habits/${id}/archive`, { method: 'POST' });
}

/** Create a new habit; cadence defaults to daily server-side. */
export function createHabit(input: CreateHabitInput): Promise<Habit> {
	return apiRequest<Habit>('/habits', { body: input, method: 'POST' });
}

/** Fetch a single habit by id (archived habits remain fetchable). */
export function getHabit(id: string, signal?: AbortSignal): Promise<Habit> {
	return apiRequest<Habit>(`/habits/${id}`, { signal });
}

/** List all non-archived habits. */
export function listHabits(signal?: AbortSignal): Promise<Habit[]> {
	return apiRequest<Habit[]>('/habits', { signal });
}

/** Apply a partial update to a habit. */
export function updateHabit(id: string, input: UpdateHabitInput): Promise<Habit> {
	return apiRequest<Habit>(`/habits/${id}`, { body: input, method: 'PATCH' });
}

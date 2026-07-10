/**
 * Habit statistics API module — fetches derived streak and completion stats
 * from the backend `/api/v1/habits/:id/stats` endpoint. The backend is the
 * source of truth for streak math (current streak, longest streak, and the
 * rolling 30-day completion rate); the frontend just renders the result.
 */
import { apiRequest } from './client';
import { type HabitStats } from './types';

/** Fetch derived statistics for a habit. */
export function getHabitStats(habitId: string, signal?: AbortSignal): Promise<HabitStats> {
	return apiRequest<HabitStats>(`/habits/${habitId}/stats`, { signal });
}

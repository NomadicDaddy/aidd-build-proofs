/**
 * Check-ins API module — thin functions over the `/api/v1/habits/:id/checkins`
 * routes. Marking a day returns the created check-in; unmarking returns nothing
 * (the backend responds `204 No Content`).
 */
import { apiRequest } from './client';
import { type Checkin } from './types';

/** List a habit's check-ins (one row per completed day). */
export function listCheckins(habitId: string, signal?: AbortSignal): Promise<Checkin[]> {
	return apiRequest<Checkin[]>(`/habits/${habitId}/checkins`, { signal });
}

/** Mark a habit done for a given `YYYY-MM-DD` day. */
export function markCheckin(habitId: string, date: string): Promise<Checkin> {
	return apiRequest<Checkin>(`/habits/${habitId}/checkins`, { body: { date }, method: 'POST' });
}

/** Remove a habit's check-in for a given day. */
export function unmarkCheckin(habitId: string, date: string): Promise<void> {
	return apiRequest<void>(`/habits/${habitId}/checkins/${date}`, { method: 'DELETE' });
}

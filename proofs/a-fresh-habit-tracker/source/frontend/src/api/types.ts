/**
 * Frontend API types, declared independently of the backend workspace so the
 * two sides can evolve without a shared build dependency. These mirror the JSON
 * DTOs returned by the `/api/v1` routes (timestamps as ISO strings).
 */

/** Supported habit cadences (daily-only in the MVP). */
export type Cadence = 'daily';

/** A habit as returned by the API. */
export interface Habit {
	archivedAt: null | string;
	cadence: Cadence;
	createdAt: string;
	id: string;
	name: string;
	notes: null | string;
	target: null | number;
	updatedAt: string;
}

/** A single completed-day record for a habit. */
export interface Checkin {
	createdAt: string;
	date: string;
	habitId: string;
	id: string;
}

/** Payload for creating a habit; cadence defaults to daily server-side. */
export interface CreateHabitInput {
	cadence?: Cadence;
	name: string;
	notes?: null | string;
	target?: null | number;
}

/** Partial payload for updating a habit. */
export interface UpdateHabitInput {
	name?: string;
	notes?: null | string;
	target?: null | number;
}

/** Derived per-habit statistics computed from a habit's check-ins. */
export interface HabitStats {
	completionRate: number;
	currentStreak: number;
	longestStreak: number;
	totalCheckins: number;
}

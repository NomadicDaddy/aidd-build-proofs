/**
 * Streak and completion statistics derived from a habit's check-ins.
 *
 * Stats are computed purely from the set of completed calendar days
 * (`YYYY-MM-DD` keys), so the functions are deterministic given a reference
 * "today". Days are compared as whole calendar days — the stored `date` strings
 * are already local-day keys, which sidesteps time-zone drift.
 *
 * Rules:
 * - Current streak: the run of consecutive completed days ending today, or
 *   ending yesterday when today is not yet marked (the day is not over). A
 *   missed day breaks it.
 * - Longest streak: the longest consecutive run anywhere in the full history;
 *   it never decreases when the current streak resets.
 * - Completion rate: fraction of the last 30 calendar days (including today)
 *   that were completed.
 */

/** Number of days in the rolling completion-rate window. */
const COMPLETION_WINDOW_DAYS = 30;

/** Derived per-habit statistics. */
export interface HabitStats {
	completionRate: number;
	currentStreak: number;
	longestStreak: number;
	totalCheckins: number;
}

/** Format a Date as a local `YYYY-MM-DD` day key. */
function toDayKey(date: Date): string {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Parse a `YYYY-MM-DD` key into a local Date at midnight. */
function fromDayKey(key: string): Date {
	const [year, month, day] = key.split('-').map(Number) as [number, number, number];
	return new Date(year, month - 1, day);
}

/** The calendar day immediately before `date` (month-boundary safe). */
function previousDay(date: Date): Date {
	const result = new Date(date);
	result.setDate(result.getDate() - 1);
	return result;
}

/** True when `day` is exactly one calendar day after `previous`. */
function isConsecutive(previous: string, day: string): boolean {
	const next = fromDayKey(previous);
	next.setDate(next.getDate() + 1);
	return toDayKey(next) === day;
}

/** Longest run of consecutive completed days in the full history. */
function computeLongestStreak(days: Set<string>): number {
	const sorted = [...days].sort();
	let longest = 0;
	let run = 0;
	let previous: null | string = null;
	for (const day of sorted) {
		run = previous !== null && isConsecutive(previous, day) ? run + 1 : 1;
		previous = day;
		if (run > longest) longest = run;
	}
	return longest;
}

/** Consecutive completed days ending today (or yesterday if today is unmarked). */
function computeCurrentStreak(days: Set<string>, today: Date): number {
	let cursor = new Date(today);
	if (!days.has(toDayKey(cursor))) {
		cursor = previousDay(cursor);
	}
	let streak = 0;
	while (days.has(toDayKey(cursor))) {
		streak += 1;
		cursor = previousDay(cursor);
	}
	return streak;
}

/** Fraction of the last 30 calendar days (including today) that were completed. */
function computeCompletionRate(days: Set<string>, today: Date): number {
	let done = 0;
	let cursor = new Date(today);
	for (let i = 0; i < COMPLETION_WINDOW_DAYS; i += 1) {
		if (days.has(toDayKey(cursor))) done += 1;
		cursor = previousDay(cursor);
	}
	return done / COMPLETION_WINDOW_DAYS;
}

/**
 * Derive summary statistics for a habit from its completed-day keys.
 *
 * @param dates - the habit's check-in `YYYY-MM-DD` day strings (order-agnostic).
 * @param today - the reference day; defaults to the current local day.
 */
export function computeHabitStats(dates: string[], today: Date = new Date()): HabitStats {
	const days = new Set(dates);
	return {
		completionRate: computeCompletionRate(days, today),
		currentStreak: computeCurrentStreak(days, today),
		longestStreak: computeLongestStreak(days),
		totalCheckins: days.size,
	};
}

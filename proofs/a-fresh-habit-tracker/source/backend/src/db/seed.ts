/**
 * Development seed script.
 *
 * Populates the SQLite database with a handful of sample habits and check-ins
 * so the UI has realistic data to render during local development. The seeded
 * check-ins are shaped to produce visible streaks: at least one habit has an
 * active current streak ending today, and at least one has a longest streak
 * that is longer than its current streak (a broken-then-resumed pattern).
 *
 * The script is reset-safe: it uses fixed, well-known habit ids and deletes any
 * existing rows for those ids first (the FK cascade clears their check-ins), so
 * running `bun run db:seed` repeatedly always yields the same clean state
 * without touching habits a developer created by hand.
 *
 * Run with: `bun run --cwd backend db:seed`.
 */
import { inArray } from 'drizzle-orm';

import { closeDb, getDb } from './index.ts';
import { checkins, habits, type NewCheckin, type NewHabit } from './schema/index.ts';

/** Format a `Date` as a `YYYY-MM-DD` calendar day (local time). */
function toDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** The calendar day `offset` days before today (offset 0 = today). */
function daysAgo(offset: number): string {
	const date = new Date();
	date.setHours(12, 0, 0, 0);
	date.setDate(date.getDate() - offset);
	return toDateString(date);
}

/**
 * A single seed habit plus the day-offsets (from today) it was checked in on.
 * Offset 0 is today, 1 is yesterday, and so on.
 */
interface SeedHabit {
	checkinOffsets: number[];
	habit: NewHabit;
}

/** Build the list of consecutive day-offsets `[from, from+1, ... to]`. */
function offsetRange(from: number, to: number): number[] {
	const offsets: number[] = [];
	for (let offset = from; offset <= to; offset += 1) offsets.push(offset);
	return offsets;
}

const SEED_HABITS: SeedHabit[] = [
	{
		// Current streak of 6 days ending today (offsets 0..5).
		checkinOffsets: offsetRange(0, 5),
		habit: {
			cadence: 'daily',
			id: 'seed-habit-morning-run',
			name: 'Morning run',
			notes: 'A short jog around the block to start the day.',
			target: 1,
		},
	},
	{
		// Longest streak (10 days, offsets 5..14) is longer than the current
		// streak (3 days, offsets 0..2): a broken-then-resumed pattern.
		checkinOffsets: [...offsetRange(0, 2), ...offsetRange(5, 14)],
		habit: {
			cadence: 'daily',
			id: 'seed-habit-read',
			name: 'Read 30 minutes',
			notes: 'Non-fiction, before bed.',
			target: 30,
		},
	},
	{
		// Streak broken today: last check-in was yesterday, longest streak 7
		// days (offsets 1..7), current streak 0.
		checkinOffsets: offsetRange(1, 7),
		habit: {
			cadence: 'daily',
			id: 'seed-habit-meditate',
			name: 'Meditate',
			notes: 'Ten minutes of breathing.',
			target: 10,
		},
	},
	{
		// A brand-new habit with no check-ins yet.
		checkinOffsets: [],
		habit: {
			cadence: 'daily',
			id: 'seed-habit-water',
			name: 'Drink water',
			notes: 'Eight glasses across the day.',
			target: 8,
		},
	},
];

async function seed(): Promise<void> {
	const db = getDb();
	const seedHabitIds = SEED_HABITS.map((entry) => entry.habit.id as string);

	// Reset-safe: remove any prior seed rows (cascade clears their check-ins)
	// before reinserting, so repeated runs converge on the same state.
	await db.delete(habits).where(inArray(habits.id, seedHabitIds));

	const now = new Date();
	const habitRows: NewHabit[] = SEED_HABITS.map((entry) => ({
		...entry.habit,
		createdAt: now,
		updatedAt: now,
	}));
	await db.insert(habits).values(habitRows);

	const checkinRows: NewCheckin[] = SEED_HABITS.flatMap((entry) =>
		entry.checkinOffsets.map((offset) => ({
			date: daysAgo(offset),
			habitId: entry.habit.id as string,
		}))
	);
	if (checkinRows.length > 0) await db.insert(checkins).values(checkinRows);

	console.log(
		`Seeded ${habitRows.length} habits and ${checkinRows.length} check-ins into the dev database.`
	);
}

try {
	await seed();
} catch (err) {
	console.error('Seed failed:', err);
	process.exitCode = 1;
} finally {
	closeDb();
}

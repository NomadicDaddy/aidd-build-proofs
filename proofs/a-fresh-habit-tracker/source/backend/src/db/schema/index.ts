/**
 * Barrel file for the Drizzle schema. Re-exports every table (and its inferred
 * row types) so the db client and services import from a single module.
 */
export { checkins, type Checkin, type NewCheckin } from './checkins.ts';
export { habits, type Habit, type NewHabit } from './habits.ts';

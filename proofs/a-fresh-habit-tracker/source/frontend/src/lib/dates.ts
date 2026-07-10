/**
 * Local-calendar date helpers used by the habit list. Days are represented as
 * `YYYY-MM-DD` keys compared in the browser's local zone, matching the check-in
 * date format returned by the API.
 */

/** Format a Date as a local `YYYY-MM-DD` day key. */
export function toDayKey(date: Date): string {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Today's local `YYYY-MM-DD` day key. */
export function todayKey(): string {
	return toDayKey(new Date());
}

/** A single day in a rolling window: its key, Date, and short weekday label. */
export interface WindowDay {
	date: Date;
	isToday: boolean;
	key: string;
	weekday: string;
}

/**
 * The last `count` calendar days ending today, oldest first. Each entry carries
 * its day key and a one-letter weekday label for compact grid rendering.
 */
export function lastNDays(count: number): WindowDay[] {
	const today = new Date();
	const todayString = toDayKey(today);
	const days: WindowDay[] = [];
	for (let offset = count - 1; offset >= 0; offset -= 1) {
		const date = new Date(today);
		date.setDate(date.getDate() - offset);
		const key = toDayKey(date);
		days.push({
			date,
			isToday: key === todayString,
			key,
			weekday: date.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0),
		});
	}
	return days;
}

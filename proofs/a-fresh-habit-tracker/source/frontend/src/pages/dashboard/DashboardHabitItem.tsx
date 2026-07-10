/**
 * A compact dashboard row for a single habit: its name, current streak, and a
 * quick done/undo toggle for today. Check-ins and stats are read from the shared
 * query cache (the same keys the list page uses), so toggling here refreshes the
 * dashboard summary, the weekly grid, and the list page together.
 */
import { Check, Flame } from 'lucide-react';

import { type Habit } from '@/api/types';
import { useCheckins, useHabitStats, useToggleCheckin } from '@/hooks/useCheckins';
import { todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface DashboardHabitItemProps {
	habit: Habit;
}

export function DashboardHabitItem({ habit }: DashboardHabitItemProps) {
	const checkinsQuery = useCheckins(habit.id);
	const statsQuery = useHabitStats(habit.id);
	const toggle = useToggleCheckin();

	const today = todayKey();
	const doneToday = (checkinsQuery.data ?? []).some((checkin) => checkin.date === today);
	const currentStreak = statsQuery.data?.currentStreak ?? 0;

	function handleToggleToday() {
		toggle.mutate({ date: today, done: !doneToday, habitId: habit.id });
	}

	return (
		<li className="border-border bg-card flex items-center justify-between gap-4 rounded-lg border p-4">
			<div className="min-w-0 space-y-1">
				<h3 className="truncate text-base font-semibold">{habit.name}</h3>
				<p className="text-muted-foreground flex items-center gap-1 text-sm">
					<Flame aria-hidden className="size-3.5" />
					<span className="text-foreground font-medium">{currentStreak}</span>
					<span>day streak</span>
				</p>
			</div>

			<button
				aria-label={doneToday ? 'Mark today not done' : 'Mark today done'}
				aria-pressed={doneToday}
				className={cn(
					'inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
					'disabled:cursor-not-allowed disabled:opacity-60',
					doneToday
						? 'bg-primary text-primary-foreground border-transparent hover:opacity-90'
						: 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
				)}
				disabled={toggle.isPending}
				onClick={handleToggleToday}
				type="button">
				<Check className="size-4" />
				{doneToday ? 'Done' : 'Mark done'}
			</button>
		</li>
	);
}

/**
 * Dashboard — the app landing route. Gives an at-a-glance overview of today:
 * how many habits are done vs. total, a rolling 7-day grid aggregated across all
 * (non-archived) habits, and each habit with a quick done/undo toggle. Check-ins
 * are read from the same shared query cache the list page uses, so the two views
 * always agree and toggling anywhere updates the counts and grid live.
 */
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { listCheckins } from '@/api/checkins';
import { queryKeys } from '@/api/queryKeys';
import { useHabits } from '@/hooks/useHabits';
import { lastNDays, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { DashboardHabitItem } from './DashboardHabitItem';

const GRID_DAYS = 7;

export function DashboardPage() {
	const { data: habits, error, isPending } = useHabits();
	const habitList = habits ?? [];

	// One check-in query per habit, keyed the same way the list page keys them,
	// so both views share a single cache entry per habit.
	const checkinQueries = useQueries({
		queries: habitList.map((habit) => ({
			queryFn: ({ signal }: { signal: AbortSignal }) => listCheckins(habit.id, signal),
			queryKey: queryKeys.checkins(habit.id),
		})),
	});

	if (isPending) {
		return <DashboardSkeleton />;
	}

	if (error) {
		return (
			<section className="space-y-3">
				<DashboardHeader />
				<p className="border-destructive/50 text-destructive rounded-lg border p-4 text-sm">
					Couldn&rsquo;t load your habits. {error.message}
				</p>
			</section>
		);
	}

	if (habitList.length === 0) {
		return (
			<section className="space-y-6">
				<DashboardHeader />
				<EmptyState />
			</section>
		);
	}

	const today = todayKey();
	const window = lastNDays(GRID_DAYS);

	// Aggregate today's completion and per-day counts across all habits from the
	// shared check-in cache.
	const doneDatesByHabit = habitList.map(
		(_, index) => new Set((checkinQueries[index]?.data ?? []).map((checkin) => checkin.date))
	);
	const doneToday = doneDatesByHabit.filter((dates) => dates.has(today)).length;
	const total = habitList.length;
	const donePct = total > 0 ? Math.round((doneToday / total) * 100) : 0;

	return (
		<section className="space-y-8">
			<DashboardHeader />

			<div className="border-border bg-card space-y-3 rounded-lg border p-5">
				<div className="flex items-baseline justify-between gap-4">
					<p className="text-sm font-medium">Today&rsquo;s progress</p>
					<p className="text-muted-foreground text-sm">
						<span className="text-foreground text-lg font-semibold">{doneToday}</span>{' '}
						of {total} done
					</p>
				</div>
				<div
					aria-label={`${doneToday} of ${total} habits done today`}
					aria-valuemax={total}
					aria-valuemin={0}
					aria-valuenow={doneToday}
					className="bg-muted h-2 overflow-hidden rounded-full"
					role="progressbar">
					<div
						className="bg-primary h-full rounded-full transition-all"
						style={{ width: `${donePct}%` }}
					/>
				</div>
			</div>

			<div className="space-y-3">
				<h2 className="text-sm font-medium">Last 7 days</h2>
				<div className="border-border bg-card flex justify-between gap-1 rounded-lg border p-3 sm:gap-1.5 sm:p-4">
					{window.map((day) => {
						const count = doneDatesByHabit.filter((dates) => dates.has(day.key)).length;
						const allDone = total > 0 && count === total;
						return (
							<div
								aria-label={`${day.key}: ${count} of ${total} done`}
								className="flex flex-1 flex-col items-center gap-1.5"
								key={day.key}
								title={`${day.key}: ${count}/${total} done`}>
								<span className="text-muted-foreground text-[10px] uppercase">
									{day.weekday}
								</span>
								<span
									className={cn(
										'flex size-8 items-center justify-center rounded-md border text-xs font-medium tabular-nums sm:size-9',
										count > 0
											? allDone
												? 'bg-primary text-primary-foreground border-transparent'
												: 'bg-primary/15 text-foreground border-transparent'
											: 'border-border bg-muted text-muted-foreground',
										day.isToday && 'ring-ring ring-2 ring-offset-1'
									)}>
									{count}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			<div className="space-y-3">
				<h2 className="text-sm font-medium">Today&rsquo;s habits</h2>
				<ul className="space-y-3">
					{habitList.map((habit) => (
						<DashboardHabitItem habit={habit} key={habit.id} />
					))}
				</ul>
			</div>
		</section>
	);
}

/** Page title with today's local date. */
function DashboardHeader() {
	const label = new Date().toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'long',
		weekday: 'long',
	});
	return (
		<header className="space-y-1">
			<h1 className="text-2xl font-semibold">Today</h1>
			<p className="text-muted-foreground text-sm">{label}</p>
		</header>
	);
}

/**
 * Shown when the user has no habits yet. The CTA links to the Habits page, where
 * the create-habit form lives, so the empty state routes to the create action.
 */
function EmptyState() {
	return (
		<div className="border-border rounded-lg border border-dashed p-10 text-center">
			<h2 className="text-lg font-semibold">No habits yet</h2>
			<p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
				Add a habit and it&rsquo;ll show up here with a quick toggle, a done-vs-total count,
				and a rolling weekly grid.
			</p>
			<Link
				className={cn(
					'bg-primary text-primary-foreground mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-opacity',
					'hover:opacity-90'
				)}
				to="/habits">
				Add your first habit
			</Link>
		</div>
	);
}

/** Loading placeholder shown while the habit list is pending. */
function DashboardSkeleton() {
	return (
		<section className="space-y-8">
			<DashboardHeader />
			<div className="bg-muted h-20 animate-pulse rounded-lg" />
			<div className="bg-muted h-24 animate-pulse rounded-lg" />
			<ul aria-hidden className="space-y-3">
				{[0, 1, 2].map((index) => (
					<li className="bg-muted h-20 animate-pulse rounded-lg" key={index} />
				))}
			</ul>
		</section>
	);
}

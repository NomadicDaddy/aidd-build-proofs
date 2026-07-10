/**
 * Habit list page: renders all non-archived habits, each with its current
 * streak, a compact 7-day check-in grid, and a today done/undo toggle. Handles
 * loading, error, and empty states. Archived habits are excluded server-side
 * (the list route only returns non-archived habits).
 */
import { useHabits } from '@/hooks/useHabits';
import { cn } from '@/lib/utils';

import { HabitCreateForm } from './HabitCreateForm';
import { HabitRow } from './HabitRow';

export function HabitsPage() {
	const { data: habits, error, isPending } = useHabits();

	return (
		<section className="space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold">Habits</h1>
				<p className="text-muted-foreground">
					Track today&rsquo;s progress and your recent streaks.
				</p>
			</header>

			<HabitCreateForm />

			{isPending ? (
				<HabitsSkeleton />
			) : error ? (
				<p className="border-destructive/50 text-destructive rounded-lg border p-4 text-sm">
					Couldn&rsquo;t load your habits. {error.message}
				</p>
			) : habits.length === 0 ? (
				<EmptyState />
			) : (
				<ul className="space-y-3">
					{habits.map((habit) => (
						<HabitRow habit={habit} key={habit.id} />
					))}
				</ul>
			)}
		</section>
	);
}

/** Placeholder rows shown while the habit list is loading. */
function HabitsSkeleton() {
	return (
		<ul aria-hidden className="space-y-3">
			{[0, 1, 2].map((index) => (
				<li className="border-border bg-card rounded-lg border p-4" key={index}>
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-2">
							<div className="bg-muted h-4 w-40 animate-pulse rounded" />
							<div className="bg-muted h-3 w-24 animate-pulse rounded" />
						</div>
						<div className="bg-muted h-8 w-28 animate-pulse rounded-md" />
					</div>
					<div className="mt-4 flex gap-1.5">
						{[0, 1, 2, 3, 4, 5, 6].map((cell) => (
							<div className="bg-muted size-6 animate-pulse rounded-sm" key={cell} />
						))}
					</div>
				</li>
			))}
		</ul>
	);
}

/**
 * Shown when the user has no habits yet. The CTA focuses the create-habit form
 * (rendered above) so the empty state links straight to the create action.
 */
function EmptyState() {
	function focusCreateForm() {
		const form = document.getElementById('add-habit');
		form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		document.getElementById('habit-name')?.focus({ preventScroll: true });
	}

	return (
		<div className="border-border rounded-lg border border-dashed p-10 text-center">
			<h2 className="text-lg font-semibold">No habits yet</h2>
			<p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
				Once you add a habit, it&rsquo;ll show up here with a today toggle and a rolling
				7-day grid so you can keep your streak going.
			</p>
			<button
				className={cn(
					'bg-primary text-primary-foreground mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-opacity',
					'hover:opacity-90'
				)}
				onClick={focusCreateForm}
				type="button">
				Add your first habit
			</button>
		</div>
	);
}

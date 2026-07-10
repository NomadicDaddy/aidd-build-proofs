/**
 * A single habit row on the list page: name, notes/target, current streak, a
 * compact 7-day check-in grid, and a today done/undo toggle. Check-ins are
 * fetched per habit and shared (via the query cache) between the grid and the
 * derived streak, so toggling today refreshes both without a full reload.
 */
import { Archive, Check, Flame, Pencil, Percent, Trophy } from 'lucide-react';
import { useState } from 'react';

import { type Habit } from '@/api/types';
import { useCheckins, useHabitStats, useToggleCheckin } from '@/hooks/useCheckins';
import { useArchiveHabit } from '@/hooks/useHabits';
import { lastNDays, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { HabitEditForm } from './HabitEditForm';

const GRID_DAYS = 7;

/** Human-readable secondary line: target and/or notes, when present. */
function buildSubtitle(habit: Habit): null | string {
	const parts: string[] = [];
	if (habit.target !== null) {
		parts.push(`Target: ${habit.target}/day`);
	}
	if (habit.notes !== null && habit.notes.trim().length > 0) {
		parts.push(habit.notes.trim());
	}
	return parts.length > 0 ? parts.join(' · ') : null;
}

interface HabitRowProps {
	habit: Habit;
}

export function HabitRow({ habit }: HabitRowProps) {
	const checkinsQuery = useCheckins(habit.id);
	const statsQuery = useHabitStats(habit.id);
	const toggle = useToggleCheckin();
	const archive = useArchiveHabit();
	const [confirmingArchive, setConfirmingArchive] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const doneDays = new Set((checkinsQuery.data ?? []).map((checkin) => checkin.date));
	const window = lastNDays(GRID_DAYS);
	const today = todayKey();
	const doneToday = doneDays.has(today);
	const stats = statsQuery.data;
	const currentStreak = stats?.currentStreak ?? 0;
	const longestStreak = stats?.longestStreak ?? 0;
	const completionPct = stats ? Math.round(stats.completionRate * 100) : 0;
	const subtitle = buildSubtitle(habit);

	function handleToggleToday() {
		toggle.mutate({ date: today, done: !doneToday, habitId: habit.id });
	}

	function handleArchive() {
		archive.mutate(habit.id, {
			onError: () => {
				setConfirmingArchive(false);
			},
		});
	}

	if (isEditing) {
		return (
			<li className="border-border bg-card rounded-lg border p-4">
				<HabitEditForm habit={habit} onDone={() => setIsEditing(false)} />
			</li>
		);
	}

	return (
		<li className="border-border bg-card rounded-lg border p-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 space-y-1">
					<h2 className="truncate text-base font-semibold">{habit.name}</h2>
					{subtitle !== null && (
						<p className="text-muted-foreground truncate text-sm">{subtitle}</p>
					)}
					<dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
						<div className="flex items-center gap-1">
							<Flame aria-hidden className="size-3.5" />
							<dt className="sr-only">Current streak</dt>
							<dd>
								<span className="text-foreground font-medium">{currentStreak}</span>
								<span className="text-muted-foreground"> current</span>
							</dd>
						</div>
						<div className="flex items-center gap-1">
							<Trophy aria-hidden className="size-3.5" />
							<dt className="sr-only">Longest streak</dt>
							<dd>
								<span className="text-foreground font-medium">{longestStreak}</span>
								<span className="text-muted-foreground"> longest</span>
							</dd>
						</div>
						<div className="flex items-center gap-1">
							<Percent aria-hidden className="size-3.5" />
							<dt className="sr-only">30-day completion rate</dt>
							<dd>
								<span className="text-foreground font-medium">
									{completionPct}%
								</span>
								<span className="text-muted-foreground"> 30-day</span>
							</dd>
						</div>
					</dl>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2">
					<button
						aria-label={doneToday ? 'Mark today not done' : 'Mark today done'}
						aria-pressed={doneToday}
						className={cn(
							'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
							'disabled:cursor-not-allowed disabled:opacity-60',
							doneToday
								? 'bg-primary text-primary-foreground border-transparent hover:opacity-90'
								: 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
						)}
						disabled={toggle.isPending}
						onClick={handleToggleToday}
						type="button">
						<Check className="size-4" />
						{doneToday ? 'Done today' : 'Mark done'}
					</button>

					<button
						aria-label={`Edit ${habit.name}`}
						className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
						disabled={confirmingArchive}
						onClick={() => setIsEditing(true)}
						type="button">
						<Pencil className="size-4" />
						Edit
					</button>

					{confirmingArchive ? (
						<div className="flex items-center gap-1.5">
							<button
								className={cn(
									'inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium transition-colors',
									'bg-destructive text-white hover:opacity-90',
									'disabled:cursor-not-allowed disabled:opacity-60'
								)}
								disabled={archive.isPending}
								onClick={handleArchive}
								type="button">
								<Archive className="size-4" />
								Confirm
							</button>
							<button
								className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
								disabled={archive.isPending}
								onClick={() => setConfirmingArchive(false)}
								type="button">
								Cancel
							</button>
						</div>
					) : (
						<button
							aria-label={`Archive ${habit.name}`}
							className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
							onClick={() => setConfirmingArchive(true)}
							type="button">
							<Archive className="size-4" />
							Archive
						</button>
					)}
				</div>
			</div>

			<div aria-label="Last 7 days" className="mt-4 flex gap-1.5" role="list">
				{window.map((day) => {
					const isDone = doneDays.has(day.key);
					return (
						<div
							aria-label={`${day.key}${isDone ? ' completed' : ''}`}
							className="flex flex-col items-center gap-1"
							key={day.key}
							role="listitem"
							title={day.key}>
							<span className="text-muted-foreground text-[10px] uppercase">
								{day.weekday}
							</span>
							<span
								className={cn(
									'size-6 rounded-sm border',
									isDone
										? 'bg-primary border-transparent'
										: 'border-border bg-muted',
									day.isToday && 'ring-ring ring-2 ring-offset-1'
								)}
							/>
						</div>
					);
				})}
			</div>
		</li>
	);
}

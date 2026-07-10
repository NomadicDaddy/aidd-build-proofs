/**
 * Inline edit form for a single habit, shown in place of the row's summary when
 * the user clicks "Edit". Prefills the current name, notes, and target, validates
 * the name and target client-side, and submits a partial update via the update
 * mutation. On success the list refetches (surfacing the new values and the
 * advanced `updatedAt`) and the row returns to its summary view.
 */
import { useState, type FormEvent } from 'react';

import { type Habit, type UpdateHabitInput } from '@/api/types';
import { useUpdateHabit } from '@/hooks/useHabits';
import { cn } from '@/lib/utils';

const inputClass = cn(
	'border-input bg-background w-full rounded-md border px-3 py-2 text-sm',
	'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
	'disabled:cursor-not-allowed disabled:opacity-60'
);

/** Parse the raw target field into a positive number, or null when blank. */
function parseTarget(raw: string): { error: null | string; value: null | number } {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return { error: null, value: null };
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return { error: 'Target must be a positive number.', value: null };
	}
	return { error: null, value: parsed };
}

interface HabitEditFormProps {
	habit: Habit;
	onDone: () => void;
}

export function HabitEditForm({ habit, onDone }: HabitEditFormProps) {
	const update = useUpdateHabit();
	const [name, setName] = useState(habit.name);
	const [notes, setNotes] = useState(habit.notes ?? '');
	const [target, setTarget] = useState(habit.target === null ? '' : String(habit.target));
	const [nameError, setNameError] = useState<null | string>(null);
	const [targetError, setTargetError] = useState<null | string>(null);

	const nameId = `edit-name-${habit.id}`;
	const targetId = `edit-target-${habit.id}`;
	const notesId = `edit-notes-${habit.id}`;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmedName = name.trim();
		if (trimmedName.length === 0) {
			setNameError('Please enter a habit name.');
			return;
		}
		setNameError(null);

		const parsedTarget = parseTarget(target);
		if (parsedTarget.error !== null) {
			setTargetError(parsedTarget.error);
			return;
		}
		setTargetError(null);

		const trimmedNotes = notes.trim();
		const input: UpdateHabitInput = {
			name: trimmedName,
			notes: trimmedNotes.length > 0 ? trimmedNotes : null,
			target: parsedTarget.value,
		};

		update.mutate({ id: habit.id, input }, { onSuccess: onDone });
	}

	return (
		<form className="space-y-4" noValidate onSubmit={handleSubmit}>
			<div className="space-y-1">
				<h2 className="text-base font-semibold">Edit habit</h2>
				<p className="text-muted-foreground text-sm">
					Update the name, notes, or target for this habit.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor={nameId}>
						Name
					</label>
					<input
						aria-describedby={nameError !== null ? `${nameId}-error` : undefined}
						aria-invalid={nameError !== null}
						className={inputClass}
						disabled={update.isPending}
						id={nameId}
						onChange={(event) => {
							setName(event.target.value);
							if (nameError !== null) setNameError(null);
						}}
						type="text"
						value={name}
					/>
					{nameError !== null && (
						<p className="text-destructive text-sm" id={`${nameId}-error`}>
							{nameError}
						</p>
					)}
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor={targetId}>
						Target <span className="text-muted-foreground">(optional)</span>
					</label>
					<input
						aria-describedby={targetError !== null ? `${targetId}-error` : undefined}
						aria-invalid={targetError !== null}
						className={inputClass}
						disabled={update.isPending}
						id={targetId}
						inputMode="numeric"
						min={1}
						onChange={(event) => {
							setTarget(event.target.value);
							if (targetError !== null) setTargetError(null);
						}}
						placeholder="e.g. 3 per day"
						type="number"
						value={target}
					/>
					{targetError !== null && (
						<p className="text-destructive text-sm" id={`${targetId}-error`}>
							{targetError}
						</p>
					)}
				</div>

				<div className="space-y-1.5 sm:col-span-2">
					<label className="text-sm font-medium" htmlFor={notesId}>
						Notes <span className="text-muted-foreground">(optional)</span>
					</label>
					<input
						className={inputClass}
						disabled={update.isPending}
						id={notesId}
						onChange={(event) => setNotes(event.target.value)}
						placeholder="Anything worth remembering"
						type="text"
						value={notes}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<button
					className={cn(
						'bg-primary text-primary-foreground inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-opacity',
						'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
					)}
					disabled={update.isPending}
					type="submit">
					{update.isPending ? 'Saving…' : 'Save changes'}
				</button>
				<button
					className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
					disabled={update.isPending}
					onClick={onDone}
					type="button">
					Cancel
				</button>
			</div>
		</form>
	);
}

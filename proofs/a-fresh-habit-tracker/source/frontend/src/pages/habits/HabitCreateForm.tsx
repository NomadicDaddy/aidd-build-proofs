/**
 * Create-habit form for the list page: a required name, a cadence select (daily
 * only in the MVP), and optional notes and target. Validates the name client-side
 * before submitting via the create mutation, surfaces server errors inline, and
 * resets its fields after a successful create so the new habit appears in the list.
 */
import { useState, type FormEvent } from 'react';

import { type Cadence, type CreateHabitInput } from '@/api/types';
import { useCreateHabit } from '@/hooks/useHabits';
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

export function HabitCreateForm() {
	const create = useCreateHabit();
	const [name, setName] = useState('');
	const [cadence, setCadence] = useState<Cadence>('daily');
	const [notes, setNotes] = useState('');
	const [target, setTarget] = useState('');
	const [nameError, setNameError] = useState<null | string>(null);
	const [targetError, setTargetError] = useState<null | string>(null);

	function resetForm() {
		setName('');
		setCadence('daily');
		setNotes('');
		setTarget('');
		setNameError(null);
		setTargetError(null);
	}

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
		const input: CreateHabitInput = {
			cadence,
			name: trimmedName,
			notes: trimmedNotes.length > 0 ? trimmedNotes : null,
			target: parsedTarget.value,
		};

		create.mutate(input, { onSuccess: resetForm });
	}

	return (
		<form
			className="border-border bg-card space-y-4 rounded-lg border p-4"
			id="add-habit"
			noValidate
			onSubmit={handleSubmit}>
			<div className="space-y-1">
				<h2 className="text-base font-semibold">Add a habit</h2>
				<p className="text-muted-foreground text-sm">
					Give it a name and start tracking today.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor="habit-name">
						Name
					</label>
					<input
						aria-describedby={nameError !== null ? 'habit-name-error' : undefined}
						aria-invalid={nameError !== null}
						className={inputClass}
						disabled={create.isPending}
						id="habit-name"
						onChange={(event) => {
							setName(event.target.value);
							if (nameError !== null) setNameError(null);
						}}
						placeholder="e.g. Morning run"
						type="text"
						value={name}
					/>
					{nameError !== null && (
						<p className="text-destructive text-sm" id="habit-name-error">
							{nameError}
						</p>
					)}
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor="habit-cadence">
						Cadence
					</label>
					<select
						className={inputClass}
						disabled={create.isPending}
						id="habit-cadence"
						onChange={(event) => setCadence(event.target.value as Cadence)}
						value={cadence}>
						<option value="daily">Daily</option>
					</select>
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor="habit-target">
						Target <span className="text-muted-foreground">(optional)</span>
					</label>
					<input
						aria-describedby={targetError !== null ? 'habit-target-error' : undefined}
						aria-invalid={targetError !== null}
						className={inputClass}
						disabled={create.isPending}
						id="habit-target"
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
						<p className="text-destructive text-sm" id="habit-target-error">
							{targetError}
						</p>
					)}
				</div>

				<div className="space-y-1.5">
					<label className="text-sm font-medium" htmlFor="habit-notes">
						Notes <span className="text-muted-foreground">(optional)</span>
					</label>
					<input
						className={inputClass}
						disabled={create.isPending}
						id="habit-notes"
						onChange={(event) => setNotes(event.target.value)}
						placeholder="Anything worth remembering"
						type="text"
						value={notes}
					/>
				</div>
			</div>

			{create.isError && (
				<p className="text-destructive text-sm" role="alert">
					Couldn&rsquo;t create the habit. {create.error.message}
				</p>
			)}

			<button
				className={cn(
					'bg-primary text-primary-foreground inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-opacity',
					'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
				)}
				disabled={create.isPending}
				type="submit">
				{create.isPending ? 'Adding…' : 'Add habit'}
			</button>
		</form>
	);
}

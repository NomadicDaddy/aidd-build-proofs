import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { useScenarioForm } from './ScenarioFormContext';
import { InlineFieldError } from './shared';

export function ScenarioLaborTab() {
	const {
		addLaborEntry,
		errors,
		form,
		removeLaborEntry,
		updateLaborEntry,
		updateLaborEntryNumber,
	} = useScenarioForm();

	return (
		<section className="space-y-3 rounded-md border p-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold">Labor</h2>
				<Button
					aria-label="Add labor entry"
					onClick={addLaborEntry}
					size="sm"
					type="button"
					variant="outline">
					<Plus aria-hidden="true" className="size-4" />
					Add
				</Button>
			</div>
			<div className="overflow-x-auto">
				<Table className="min-w-[64rem]">
					<TableHeader>
						<TableRow>
							<TableHead>Role</TableHead>
							<TableHead>Hours</TableHead>
							<TableHead>Internal Rate</TableHead>
							<TableHead>Billable Rate</TableHead>
							<TableHead>Burden %</TableHead>
							<TableHead>Notes</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{form.laborEntries.map((entry, index) => (
							<TableRow key={entry.localId}>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`laborEntries.${index}.roleName`]
										)}
										onChange={(event) =>
											updateLaborEntry(index, {
												roleName: event.target.value,
											})
										}
										value={entry.roleName}
									/>
									{errors[`laborEntries.${index}.roleName`] && (
										<p className="text-destructive mt-1 text-xs">
											{errors[`laborEntries.${index}.roleName`]}
										</p>
									)}
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`laborEntries.${index}.hours`]
										)}
										min="0"
										onBlur={(event) =>
											updateLaborEntryNumber(
												index,
												'hours',
												event.target.value,
												'Hours'
											)
										}
										onChange={(event) =>
											updateLaborEntryNumber(
												index,
												'hours',
												event.target.value,
												'Hours'
											)
										}
										step="0.1"
										type="number"
										value={entry.hours}
									/>
									<InlineFieldError
										error={errors[`laborEntries.${index}.hours`]}
									/>
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`laborEntries.${index}.internalHourlyCost`]
										)}
										min="0"
										onBlur={(event) =>
											updateLaborEntryNumber(
												index,
												'internalHourlyCost',
												event.target.value,
												'Internal cost'
											)
										}
										onChange={(event) =>
											updateLaborEntryNumber(
												index,
												'internalHourlyCost',
												event.target.value,
												'Internal cost'
											)
										}
										step="0.01"
										type="number"
										value={entry.internalHourlyCost}
									/>
									<InlineFieldError
										error={errors[`laborEntries.${index}.internalHourlyCost`]}
									/>
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`laborEntries.${index}.billableHourlyRate`]
										)}
										min="0"
										onBlur={(event) =>
											updateLaborEntryNumber(
												index,
												'billableHourlyRate',
												event.target.value,
												'Billable rate'
											)
										}
										onChange={(event) =>
											updateLaborEntryNumber(
												index,
												'billableHourlyRate',
												event.target.value,
												'Billable rate'
											)
										}
										step="0.01"
										type="number"
										value={entry.billableHourlyRate}
									/>
									<InlineFieldError
										error={errors[`laborEntries.${index}.billableHourlyRate`]}
									/>
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`laborEntries.${index}.burdenPercent`]
										)}
										min="0"
										onBlur={(event) =>
											updateLaborEntryNumber(
												index,
												'burdenPercent',
												event.target.value,
												'Burden'
											)
										}
										onChange={(event) =>
											updateLaborEntryNumber(
												index,
												'burdenPercent',
												event.target.value,
												'Burden'
											)
										}
										step="0.1"
										type="number"
										value={entry.burdenPercent}
									/>
									<InlineFieldError
										error={errors[`laborEntries.${index}.burdenPercent`]}
									/>
								</TableCell>
								<TableCell>
									<Input
										onChange={(event) =>
											updateLaborEntry(index, {
												notes: event.target.value,
											})
										}
										value={entry.notes}
									/>
								</TableCell>
								<TableCell>
									<Button
										aria-label="Remove labor entry"
										onClick={() => removeLaborEntry(index)}
										size="icon-sm"
										type="button"
										variant="ghost">
										<Trash2 aria-hidden="true" className="size-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

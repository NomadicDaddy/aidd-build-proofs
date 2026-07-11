import type { ScenarioStatus } from '@/api/types';

import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { useScenarioForm } from './ScenarioFormContext';
import { Field } from './shared';
import { STATUS_LABELS } from './types';

export function ScenarioHeaderFields() {
	const { errors, form, updateForm, updateScenarioNumericField } = useScenarioForm();

	return (
		<section className="rounded-md border p-4">
			<div className="grid gap-4 md:grid-cols-2">
				<Field error={errors.customerName} label="Customer name">
					<Input
						aria-invalid={Boolean(errors.customerName)}
						onChange={(event) => updateForm({ customerName: event.target.value })}
						value={form.customerName}
					/>
				</Field>
				<Field error={errors.title} label="Scenario title">
					<Input
						aria-invalid={Boolean(errors.title)}
						onChange={(event) => updateForm({ title: event.target.value })}
						value={form.title}
					/>
				</Field>
				<Field label="Status">
					<Select
						onValueChange={(value) => updateForm({ status: value as ScenarioStatus })}
						value={form.status}>
						<SelectTrigger aria-label="Scenario status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(STATUS_LABELS).map(([status, label]) => (
								<SelectItem key={status} value={status}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field error={errors.targetMarginPercent} label="Target margin %">
					<Input
						aria-invalid={Boolean(errors.targetMarginPercent)}
						min="0"
						onBlur={(event) =>
							updateScenarioNumericField(
								'targetMarginPercent',
								event.target.value,
								'Target margin',
								99.99
							)
						}
						onChange={(event) =>
							updateScenarioNumericField(
								'targetMarginPercent',
								event.target.value,
								'Target margin',
								99.99
							)
						}
						step="0.1"
						type="number"
						value={form.targetMarginPercent}
					/>
				</Field>
				<Field error={errors.taxRatePercent} label="Default tax rate %">
					<Input
						aria-invalid={Boolean(errors.taxRatePercent)}
						min="0"
						onBlur={(event) =>
							updateScenarioNumericField(
								'taxRatePercent',
								event.target.value,
								'Tax rate'
							)
						}
						onChange={(event) =>
							updateScenarioNumericField(
								'taxRatePercent',
								event.target.value,
								'Tax rate'
							)
						}
						step="0.1"
						type="number"
						value={form.taxRatePercent}
					/>
				</Field>
				<Field error={errors.contingencyPercent} label="Contingency %">
					<Input
						aria-invalid={Boolean(errors.contingencyPercent)}
						min="0"
						onBlur={(event) =>
							updateScenarioNumericField(
								'contingencyPercent',
								event.target.value,
								'Contingency'
							)
						}
						onChange={(event) =>
							updateScenarioNumericField(
								'contingencyPercent',
								event.target.value,
								'Contingency'
							)
						}
						step="0.1"
						type="number"
						value={form.contingencyPercent}
					/>
				</Field>
				<Field error={errors.discountPercent} label="Discount %">
					<Input
						aria-invalid={Boolean(errors.discountPercent)}
						min="0"
						onBlur={(event) =>
							updateScenarioNumericField(
								'discountPercent',
								event.target.value,
								'Discount',
								100
							)
						}
						onChange={(event) =>
							updateScenarioNumericField(
								'discountPercent',
								event.target.value,
								'Discount',
								100
							)
						}
						step="0.1"
						type="number"
						value={form.discountPercent}
					/>
				</Field>
			</div>
			<div className="mt-4 grid gap-4 md:grid-cols-2">
				<Field label="Notes">
					<Textarea
						onChange={(event) => updateForm({ notes: event.target.value })}
						rows={4}
						value={form.notes}
					/>
				</Field>
				<Field label="Assumptions">
					<Textarea
						onChange={(event) => updateForm({ assumptions: event.target.value })}
						rows={4}
						value={form.assumptions}
					/>
				</Field>
			</div>
		</section>
	);
}

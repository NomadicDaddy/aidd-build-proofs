import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

export function ScenarioFixedCostsTab() {
	const { addFixedCost, errors, form, removeFixedCost, updateFixedCost, updateFixedCostNumber } =
		useScenarioForm();

	return (
		<section className="space-y-3 rounded-md border p-4">
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="text-lg font-semibold">Fixed costs</h2>
				<Button
					aria-label="Add fixed cost"
					onClick={addFixedCost}
					size="sm"
					type="button"
					variant="outline">
					<Plus aria-hidden="true" className="size-4" />
					Add
				</Button>
			</div>
			<div className="overflow-x-auto">
				<Table className="min-w-[48rem]">
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Cost</TableHead>
							<TableHead>Markup %</TableHead>
							<TableHead>Tax</TableHead>
							<TableHead>Notes</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{form.fixedCosts.map((cost, index) => (
							<TableRow key={cost.localId}>
								<TableCell>
									<Input
										aria-invalid={Boolean(errors[`fixedCosts.${index}.name`])}
										onChange={(event) =>
											updateFixedCost(index, {
												name: event.target.value,
											})
										}
										value={cost.name}
									/>
									{errors[`fixedCosts.${index}.name`] && (
										<p className="text-destructive mt-1 text-xs">
											{errors[`fixedCosts.${index}.name`]}
										</p>
									)}
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(errors[`fixedCosts.${index}.cost`])}
										min="0"
										onBlur={(event) =>
											updateFixedCostNumber(
												index,
												'cost',
												event.target.value,
												'Cost'
											)
										}
										onChange={(event) =>
											updateFixedCostNumber(
												index,
												'cost',
												event.target.value,
												'Cost'
											)
										}
										step="0.01"
										type="number"
										value={cost.cost}
									/>
									{errors[`fixedCosts.${index}.cost`] && (
										<p className="text-destructive mt-1 text-xs">
											{errors[`fixedCosts.${index}.cost`]}
										</p>
									)}
								</TableCell>
								<TableCell>
									<Input
										aria-invalid={Boolean(
											errors[`fixedCosts.${index}.markupPercent`]
										)}
										min="0"
										onBlur={(event) =>
											updateFixedCostNumber(
												index,
												'markupPercent',
												event.target.value,
												'Markup'
											)
										}
										onChange={(event) =>
											updateFixedCostNumber(
												index,
												'markupPercent',
												event.target.value,
												'Markup'
											)
										}
										step="0.1"
										type="number"
										value={cost.markupPercent}
									/>
									{errors[`fixedCosts.${index}.markupPercent`] && (
										<p className="text-destructive mt-1 text-xs">
											{errors[`fixedCosts.${index}.markupPercent`]}
										</p>
									)}
								</TableCell>
								<TableCell>
									<Checkbox
										aria-label="Fixed cost taxable"
										checked={cost.taxable}
										onCheckedChange={(checked) =>
											updateFixedCost(index, {
												taxable: checked === true,
											})
										}
									/>
								</TableCell>
								<TableCell>
									<Input
										onChange={(event) =>
											updateFixedCost(index, {
												notes: event.target.value,
											})
										}
										value={cost.notes}
									/>
								</TableCell>
								<TableCell>
									<Button
										aria-label="Remove fixed cost"
										onClick={() => removeFixedCost(index)}
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

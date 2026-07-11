import { Plus, Trash2 } from 'lucide-react';

import type { ScenarioLineItemCategory } from '@/api/types';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { CUSTOM_CATALOG_VALUE, getCatalogItemLabel, getCatalogSelectValue } from './helpers';
import { useScenarioForm } from './ScenarioFormContext';
import { CATEGORY_LABELS } from './types';

export function ScenarioLineItemsTab() {
	const {
		addLineItem,
		catalogItems,
		errors,
		form,
		removeLineItem,
		updateLineItem,
		updateLineItemCatalog,
	} = useScenarioForm();

	return (
		<section className="min-w-0 space-y-3 rounded-md border p-4">
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="text-lg font-semibold">Line items</h2>
				<Button
					aria-label="Add line item"
					onClick={addLineItem}
					size="sm"
					type="button"
					variant="outline">
					<Plus aria-hidden="true" className="size-4" />
					Add
				</Button>
			</div>
			<div className="max-w-full overflow-x-auto">
				<Table className="min-w-[88rem]">
					<TableHeader>
						<TableRow>
							<TableHead>Catalog</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Unit</TableHead>
							<TableHead>Qty</TableHead>
							<TableHead>Unit Cost</TableHead>
							<TableHead>Markup %</TableHead>
							<TableHead>Tax</TableHead>
							<TableHead>Notes</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{form.lineItems.map((item, index) => {
							const isCatalogItemUnlisted =
								item.catalogItemId !== null &&
								!catalogItems.some(
									(catalogItem) => catalogItem.id === item.catalogItemId
								);

							return (
								<TableRow key={item.localId}>
									<TableCell>
										<Select
											onValueChange={(value) =>
												updateLineItemCatalog(index, value)
											}
											value={getCatalogSelectValue(item.catalogItemId)}>
											<SelectTrigger
												aria-label="Line item catalog source"
												className="w-56">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={CUSTOM_CATALOG_VALUE}>
													Custom line
												</SelectItem>
												{isCatalogItemUnlisted && (
													<SelectItem value={String(item.catalogItemId)}>
														Linked catalog #{item.catalogItemId}
													</SelectItem>
												)}
												{catalogItems.map((catalogItem) => (
													<SelectItem
														key={catalogItem.id}
														value={String(catalogItem.id)}>
														{getCatalogItemLabel(catalogItem)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										<Input
											aria-invalid={Boolean(
												errors[`lineItems.${index}.name`]
											)}
											onChange={(event) =>
												updateLineItem(index, {
													name: event.target.value,
												})
											}
											value={item.name}
										/>
										{errors[`lineItems.${index}.name`] && (
											<p className="text-destructive mt-1 text-xs">
												{errors[`lineItems.${index}.name`]}
											</p>
										)}
									</TableCell>
									<TableCell>
										<Select
											onValueChange={(value) =>
												updateLineItem(index, {
													category: value as ScenarioLineItemCategory,
												})
											}
											value={item.category}>
											<SelectTrigger aria-label="Line item category">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(CATEGORY_LABELS).map(
													([category, label]) => (
														<SelectItem key={category} value={category}>
															{label}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										<Input
											aria-invalid={Boolean(
												errors[`lineItems.${index}.unit`]
											)}
											onChange={(event) =>
												updateLineItem(index, {
													unit: event.target.value,
												})
											}
											value={item.unit}
										/>
										{errors[`lineItems.${index}.unit`] && (
											<p className="text-destructive mt-1 text-xs">
												{errors[`lineItems.${index}.unit`]}
											</p>
										)}
									</TableCell>
									<TableCell>
										<Input
											aria-invalid={Boolean(
												errors[`lineItems.${index}.quantity`]
											)}
											min="0"
											onChange={(event) =>
												updateLineItem(index, {
													quantity: event.target.value,
												})
											}
											step="0.01"
											type="number"
											value={item.quantity}
										/>
										{errors[`lineItems.${index}.quantity`] && (
											<p className="text-destructive mt-1 text-xs">
												{errors[`lineItems.${index}.quantity`]}
											</p>
										)}
									</TableCell>
									<TableCell>
										<Input
											aria-invalid={Boolean(
												errors[`lineItems.${index}.unitCost`]
											)}
											min="0"
											onChange={(event) =>
												updateLineItem(index, {
													unitCost: event.target.value,
												})
											}
											step="0.01"
											type="number"
											value={item.unitCost}
										/>
										{errors[`lineItems.${index}.unitCost`] && (
											<p className="text-destructive mt-1 text-xs">
												{errors[`lineItems.${index}.unitCost`]}
											</p>
										)}
									</TableCell>
									<TableCell>
										<Input
											aria-invalid={Boolean(
												errors[`lineItems.${index}.markupPercent`]
											)}
											min="0"
											onChange={(event) =>
												updateLineItem(index, {
													markupPercent: event.target.value,
												})
											}
											step="0.1"
											type="number"
											value={item.markupPercent}
										/>
										{errors[`lineItems.${index}.markupPercent`] && (
											<p className="text-destructive mt-1 text-xs">
												{errors[`lineItems.${index}.markupPercent`]}
											</p>
										)}
									</TableCell>
									<TableCell>
										<Checkbox
											aria-label="Line item taxable"
											checked={item.taxable}
											onCheckedChange={(checked) =>
												updateLineItem(index, {
													taxable: checked === true,
												})
											}
										/>
									</TableCell>
									<TableCell>
										<Input
											onChange={(event) =>
												updateLineItem(index, {
													notes: event.target.value,
												})
											}
											value={item.notes}
										/>
									</TableCell>
									<TableCell>
										<Button
											aria-label="Remove line item"
											onClick={() => removeLineItem(index)}
											size="icon-sm"
											type="button"
											variant="ghost">
											<Trash2 aria-hidden="true" className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

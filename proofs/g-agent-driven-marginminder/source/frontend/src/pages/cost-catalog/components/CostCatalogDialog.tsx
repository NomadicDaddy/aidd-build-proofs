import { Save, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import type {
	CostCatalogCategory,
	CostCatalogItem,
	CostCatalogItemInput,
	CostCatalogItemUpdateInput,
} from '@/api/types';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES: CostCatalogCategory[] = [
	'labor',
	'material',
	'subcontractor',
	'overhead',
	'fee',
	'other',
];

const CATEGORY_LABELS: Record<CostCatalogCategory, string> = {
	fee: 'Fee',
	labor: 'Labor',
	material: 'Material',
	other: 'Other',
	overhead: 'Overhead',
	subcontractor: 'Subcontractor',
};

interface CostCatalogFormState {
	active: boolean;
	category: CostCatalogCategory;
	defaultMarkupPercent: string;
	lastReviewedAt: string;
	name: string;
	notes: string;
	taxable: boolean;
	unit: string;
	unitCost: string;
}

const EMPTY_FORM: CostCatalogFormState = {
	active: true,
	category: 'material',
	defaultMarkupPercent: '0',
	lastReviewedAt: '',
	name: '',
	notes: '',
	taxable: true,
	unit: 'each',
	unitCost: '0',
};

function toDateInput(value: null | string): string {
	if (!value) return '';
	return value.slice(0, 10);
}

function numberFromInput(value: string): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function formFromItem(item: CostCatalogItem): CostCatalogFormState {
	return {
		active: item.active,
		category: item.category,
		defaultMarkupPercent: String(item.defaultMarkupPercent),
		lastReviewedAt: toDateInput(item.lastReviewedAt),
		name: item.name,
		notes: item.notes ?? '',
		taxable: item.taxable,
		unit: item.unit,
		unitCost: String(item.unitCost),
	};
}

function payloadFromForm(form: CostCatalogFormState): CostCatalogItemInput {
	return {
		active: form.active,
		category: form.category,
		defaultMarkupPercent: numberFromInput(form.defaultMarkupPercent),
		lastReviewedAt: form.lastReviewedAt ? form.lastReviewedAt : null,
		name: form.name.trim(),
		notes: form.notes.trim() ? form.notes.trim() : null,
		taxable: form.taxable,
		unit: form.unit.trim(),
		unitCost: numberFromInput(form.unitCost),
	};
}

interface CostCatalogDialogProps {
	dialogOpen: boolean;
	editingItem: CostCatalogItem | null;
	onClose: () => void;
	onSubmitCreate: (input: CostCatalogItemInput) => void;
	onSubmitUpdate: (args: { id: number; input: CostCatalogItemUpdateInput }) => void;
	pending: boolean;
}

function CostCatalogDialog({
	dialogOpen,
	editingItem,
	onClose,
	onSubmitCreate,
	onSubmitUpdate,
	pending,
}: CostCatalogDialogProps) {
	const [form, setForm] = useState<CostCatalogFormState>(() =>
		editingItem ? formFromItem(editingItem) : { ...EMPTY_FORM }
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const payload = payloadFromForm(form);
		if (!payload.name) {
			toast.error('Name is required');
			return;
		}
		if (!payload.unit) {
			toast.error('Unit is required');
			return;
		}
		if (payload.unitCost !== undefined && payload.unitCost < 0) {
			toast.error('Unit cost cannot be negative');
			return;
		}
		if (payload.defaultMarkupPercent !== undefined && payload.defaultMarkupPercent < 0) {
			toast.error('Markup cannot be negative');
			return;
		}

		if (editingItem) {
			onSubmitUpdate({ id: editingItem.id, input: payload });
			return;
		}

		onSubmitCreate(payload);
	}

	let description: ReactNode;
	if (editingItem) {
		description = editingItem.name;
	} else {
		description = 'Create a reusable cost assumption.';
	}

	return (
		<Dialog onOpenChange={(open) => !open && onClose()} open={dialogOpen}>
			<DialogContent className="sm:max-w-2xl">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{editingItem ? 'Edit Catalog Item' : 'New Catalog Item'}
						</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4 md:grid-cols-2">
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="catalog-name">Name</Label>
							<Input
								id="catalog-name"
								maxLength={100}
								onChange={(event) => setForm({ ...form, name: event.target.value })}
								required
								value={form.name}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="catalog-category">Category</Label>
							<Select
								onValueChange={(value) =>
									setForm({ ...form, category: value as CostCatalogCategory })
								}
								value={form.category}>
								<SelectTrigger id="catalog-category">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CATEGORIES.map((option) => (
										<SelectItem key={option} value={option}>
											{CATEGORY_LABELS[option]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="catalog-unit">Unit</Label>
							<Input
								id="catalog-unit"
								maxLength={50}
								onChange={(event) => setForm({ ...form, unit: event.target.value })}
								required
								value={form.unit}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="catalog-unit-cost">Unit Cost</Label>
							<Input
								id="catalog-unit-cost"
								min="0"
								onChange={(event) =>
									setForm({ ...form, unitCost: event.target.value })
								}
								required
								step="0.01"
								type="number"
								value={form.unitCost}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="catalog-markup">Markup Percent</Label>
							<Input
								id="catalog-markup"
								min="0"
								onChange={(event) =>
									setForm({
										...form,
										defaultMarkupPercent: event.target.value,
									})
								}
								required
								step="0.1"
								type="number"
								value={form.defaultMarkupPercent}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="catalog-reviewed">Last Reviewed</Label>
							<Input
								id="catalog-reviewed"
								onChange={(event) =>
									setForm({ ...form, lastReviewedAt: event.target.value })
								}
								type="date"
								value={form.lastReviewedAt}
							/>
						</div>
						<div className="flex items-center justify-between rounded-md border px-3 py-2">
							<Label htmlFor="catalog-taxable">Taxable</Label>
							<Switch
								checked={form.taxable}
								id="catalog-taxable"
								onCheckedChange={(checked) =>
									setForm({ ...form, taxable: checked })
								}
							/>
						</div>
						<div className="flex items-center justify-between rounded-md border px-3 py-2">
							<Label htmlFor="catalog-active">Active</Label>
							<Switch
								checked={form.active}
								id="catalog-active"
								onCheckedChange={(checked) => setForm({ ...form, active: checked })}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="catalog-notes">Notes</Label>
							<Textarea
								id="catalog-notes"
								maxLength={4000}
								onChange={(event) =>
									setForm({ ...form, notes: event.target.value })
								}
								value={form.notes}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							disabled={pending}
							onClick={() => onClose()}
							type="button"
							variant="outline">
							<X aria-hidden="true" className="size-4" />
							Cancel
						</Button>
						<Button disabled={pending} type="submit">
							<Save aria-hidden="true" className="size-4" />
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export { CostCatalogDialog };

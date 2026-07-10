import { useState } from 'react';

import type { StorageAllocation, StorageAllocationInput } from '@/api/assets';

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
import { Textarea } from '@/components/ui/textarea';

/**
 * Local editable shape. Every field is a string so the inputs stay controlled;
 * numeric fields (capacity, used, pool id) are parsed on submit and empty
 * strings clear the column.
 */
interface AllocationForm {
	capacityGb: string;
	mountPoint: string;
	name: string;
	notes: string;
	storagePoolAssetId: string;
	storageType: string;
	usedGb: string;
}

const EMPTY_FORM: AllocationForm = {
	capacityGb: '',
	mountPoint: '',
	name: '',
	notes: '',
	storagePoolAssetId: '',
	storageType: '',
	usedGb: '',
};

/** Render a nullable value as a form string (numbers become their decimal text). */
function toField(value: null | number | string): string {
	if (value === null) return '';
	return String(value);
}

function allocationToForm(allocation: StorageAllocation): AllocationForm {
	return {
		capacityGb: toField(allocation.capacityGb),
		mountPoint: toField(allocation.mountPoint),
		name: toField(allocation.name),
		notes: toField(allocation.notes),
		storagePoolAssetId: toField(allocation.storagePoolAssetId),
		storageType: toField(allocation.storageType),
		usedGb: toField(allocation.usedGb),
	};
}

/** Trimmed text → `null` when empty. */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** Parse a non-negative integer field → number, or `null` when blank/invalid. */
function orNullInt(value: string): null | number {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.trunc(parsed);
}

function formToInput(form: AllocationForm): StorageAllocationInput {
	return {
		capacityGb: orNullInt(form.capacityGb),
		mountPoint: orNull(form.mountPoint),
		name: orNull(form.name),
		notes: orNull(form.notes),
		storagePoolAssetId: orNullInt(form.storagePoolAssetId),
		storageType: orNull(form.storageType),
		usedGb: orNullInt(form.usedGb),
	};
}

interface TextFieldProps {
	id: string;
	label: string;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: 'number' | 'text';
	value: string;
}

function TextField({ id, label, onChange, placeholder, type = 'text', value }: TextFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				autoComplete="off"
				id={id}
				{...(type === 'number' ? { min: 0, type: 'number' } : {})}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				value={value}
			/>
		</div>
	);
}

interface StorageAllocationDialogProps {
	/** Existing allocation to seed the form, or `null` when adding a new one. */
	allocation: null | StorageAllocation;
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: StorageAllocationInput) => void;
}

/**
 * Create / edit dialog for a single asset storage allocation. Captures the name,
 * storage type, total and used capacity (GB), mount point, storage-pool asset
 * reference, and notes, emitting the full writable payload (empty fields →
 * `null`). Used capacity may not exceed total capacity (enforced server-side).
 */
export function StorageAllocationDialog({
	allocation,
	isOpen,
	isPending,
	onOpenChange,
	onSubmit,
}: StorageAllocationDialogProps) {
	const [form, setForm] = useState<AllocationForm>(EMPTY_FORM);

	// Re-seed whenever the dialog opens for a given allocation (or a fresh add).
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (allocation ? `edit-${allocation.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) {
			setForm(allocation ? allocationToForm(allocation) : EMPTY_FORM);
		}
	}

	const set = (key: keyof AllocationForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{allocation ? 'Edit storage allocation' : 'Add storage allocation'}
					</DialogTitle>
					<DialogDescription>
						Record the volume, capacity, and storage-pool details for this allocation.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-6" onSubmit={handleSubmit}>
					<section className="space-y-3">
						<h3 className="text-sm font-semibold">Volume &amp; capacity</h3>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								id="sa-name"
								label="Allocation name"
								onChange={set('name')}
								placeholder="e.g. Data volume"
								value={form.name}
							/>
							<TextField
								id="sa-type"
								label="Storage type"
								onChange={set('storageType')}
								placeholder="e.g. iscsi, nfs, local, san"
								value={form.storageType}
							/>
							<TextField
								id="sa-capacity"
								label="Total capacity (GB)"
								onChange={set('capacityGb')}
								type="number"
								value={form.capacityGb}
							/>
							<TextField
								id="sa-used"
								label="Used capacity (GB)"
								onChange={set('usedGb')}
								type="number"
								value={form.usedGb}
							/>
							<TextField
								id="sa-mount"
								label="Mount point"
								onChange={set('mountPoint')}
								placeholder="e.g. /data"
								value={form.mountPoint}
							/>
							<TextField
								id="sa-pool"
								label="Storage pool asset ID"
								onChange={set('storagePoolAssetId')}
								type="number"
								value={form.storagePoolAssetId}
							/>
						</div>
					</section>

					<section className="space-y-2">
						<Label htmlFor="sa-notes">Notes</Label>
						<Textarea
							id="sa-notes"
							onChange={(e) => set('notes')(e.target.value)}
							rows={2}
							value={form.notes}
						/>
					</section>

					<DialogFooter>
						<Button disabled={isPending} type="submit">
							{isPending ? 'Saving…' : 'Save allocation'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

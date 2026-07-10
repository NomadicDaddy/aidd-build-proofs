import type { CriticalityLevel } from 'spernakit-shared';

import { useState } from 'react';
import { CRITICALITY_LEVELS } from 'spernakit-shared';

import type { CreateServiceInput, Service } from '@/api/services';

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
import { Textarea } from '@/components/ui/textarea';
import { useOwners } from '@/hooks/owners/useOwners';

import { criticalityLabel, SERVICE_CATEGORY_SUGGESTIONS } from './serviceDisplay';

/** Sentinel select value representing "no owner". */
const NO_OWNER = 'none';

/** Local editable shape. Optional text fields default to empty strings. */
interface ServiceForm {
	category: string;
	criticality: CriticalityLevel;
	description: string;
	expectedAvailability: string;
	name: string;
	notes: string;
	ownerId: string;
}

const EMPTY_FORM: ServiceForm = {
	category: '',
	criticality: 'unknown',
	description: '',
	expectedAvailability: '',
	name: '',
	notes: '',
	ownerId: NO_OWNER,
};

function serviceToForm(service: Service): ServiceForm {
	return {
		category: service.category ?? '',
		criticality: service.criticality,
		description: service.description ?? '',
		expectedAvailability: service.expectedAvailability ?? '',
		name: service.name,
		notes: service.notes ?? '',
		ownerId: service.ownerId === null ? NO_OWNER : String(service.ownerId),
	};
}

/** Convert a trimmed text field to `null` when empty (clears the column). */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** Build the create/update payload from the current form state. */
function formToInput(form: ServiceForm): CreateServiceInput {
	return {
		category: orNull(form.category),
		criticality: form.criticality,
		description: orNull(form.description),
		expectedAvailability: orNull(form.expectedAvailability),
		name: form.name.trim(),
		notes: orNull(form.notes),
		ownerId: form.ownerId === NO_OWNER ? null : Number(form.ownerId),
	};
}

interface ServiceFormDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateServiceInput) => void;
	/** Service being edited, or `null` for create mode. */
	service: null | Service;
}

/**
 * Create / edit dialog for a catalog service. In edit mode the form is seeded
 * from the selected service; in create mode it starts from sensible defaults.
 * Owner options are loaded from the owners API. Emits the full writable payload
 * (empty text fields become `null`).
 */
export function ServiceFormDialog({
	isOpen,
	isPending,
	onOpenChange,
	onSubmit,
	service,
}: ServiceFormDialogProps) {
	const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
	const { data: ownersData } = useOwners();
	const owners = ownersData?.data ?? [];
	const isEdit = service !== null;

	// Re-seed the form whenever the dialog opens (create vs. a specific service).
	// Adjusting state during render — keyed on the current open target — is
	// React's recommended alternative to `useEffect(setState)`.
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (service ? `edit-${service.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) setForm(service ? serviceToForm(service) : EMPTY_FORM);
	}

	const nameValid = form.name.trim().length > 0;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!nameValid) return;
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? 'Edit Service' : 'Create Service'}</DialogTitle>
					<DialogDescription>
						{isEdit
							? 'Update the details for this catalog service.'
							: 'Add a new business or technical service to the catalog.'}
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" noValidate onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="service-name">Name</Label>
						<Input
							autoComplete="off"
							id="service-name"
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							required
							value={form.name}
							{...(nameValid ? {} : { 'aria-invalid': true })}
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="service-category">Category</Label>
							<Input
								autoComplete="off"
								id="service-category"
								list="service-category-options"
								onChange={(e) =>
									setForm((f) => ({ ...f, category: e.target.value }))
								}
								placeholder="e.g. networking"
								value={form.category}
							/>
							<datalist id="service-category-options">
								{SERVICE_CATEGORY_SUGGESTIONS.map((cat) => (
									<option key={cat} value={cat} />
								))}
							</datalist>
						</div>
						<div className="space-y-2">
							<Label htmlFor="service-criticality">Criticality</Label>
							<Select
								onValueChange={(value) =>
									setForm((f) => ({
										...f,
										criticality: value as CriticalityLevel,
									}))
								}
								value={form.criticality}>
								<SelectTrigger id="service-criticality">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CRITICALITY_LEVELS.map((level) => (
										<SelectItem key={level} value={level}>
											{criticalityLabel(level)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="service-owner">Owner</Label>
							<Select
								onValueChange={(value) =>
									setForm((f) => ({ ...f, ownerId: value }))
								}
								value={form.ownerId}>
								<SelectTrigger id="service-owner">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_OWNER}>No owner</SelectItem>
									{owners.map((owner) => (
										<SelectItem key={owner.id} value={String(owner.id)}>
											{owner.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="service-availability">Expected availability</Label>
							<Input
								autoComplete="off"
								id="service-availability"
								onChange={(e) =>
									setForm((f) => ({
										...f,
										expectedAvailability: e.target.value,
									}))
								}
								placeholder="e.g. 99.9% / 24x7"
								value={form.expectedAvailability}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="service-description">Business purpose</Label>
						<Textarea
							id="service-description"
							onChange={(e) =>
								setForm((f) => ({ ...f, description: e.target.value }))
							}
							placeholder="What this service delivers to the business."
							rows={3}
							value={form.description}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="service-notes">Notes</Label>
						<Textarea
							id="service-notes"
							onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
							rows={2}
							value={form.notes}
						/>
					</div>

					<DialogFooter>
						<Button disabled={isPending || !nameValid} type="submit">
							{isPending
								? isEdit
									? 'Saving…'
									: 'Creating…'
								: isEdit
									? 'Save Changes'
									: 'Create Service'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

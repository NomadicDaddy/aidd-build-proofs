import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AssignedService, CreateAssignmentInput, UpdateAssignmentInput } from '@/api/assets';

import { listServices } from '@/api/services';
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

/** Upper bound on the service picker options; the catalog is small in practice. */
const SERVICE_PICKER_LIMIT = 200;

/** Local editable shape. Text fields are strings; `isPrimary` binds to a switch. */
interface AssignmentForm {
	isPrimary: boolean;
	notes: string;
	role: string;
	serviceId: string;
}

const EMPTY_FORM: AssignmentForm = {
	isPrimary: false,
	notes: '',
	role: '',
	serviceId: '',
};

function assignmentToForm(assignment: AssignedService): AssignmentForm {
	return {
		isPrimary: assignment.isPrimary,
		notes: assignment.notes ?? '',
		role: assignment.role ?? '',
		serviceId: String(assignment.serviceId),
	};
}

/** Trimmed text → `null` when empty. */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

interface AssignServiceDialogProps {
	/** Service ids already assigned to the asset, excluded from the create picker. */
	assignedServiceIds: number[];
	/** Existing assignment to edit, or `null` when assigning a new service. */
	assignment: AssignedService | null;
	isOpen: boolean;
	isPending: boolean;
	onCreate: (input: CreateAssignmentInput) => void;
	onOpenChange: (open: boolean) => void;
	onUpdate: (input: UpdateAssignmentInput) => void;
}

/**
 * Create / edit dialog for an asset-to-service assignment. In create mode it
 * offers a picker of catalog services not already assigned to the asset; in edit
 * mode the target service is fixed and only the role, primary flag, and notes
 * can change.
 */
export function AssignServiceDialog({
	assignedServiceIds,
	assignment,
	isOpen,
	isPending,
	onCreate,
	onOpenChange,
	onUpdate,
}: AssignServiceDialogProps) {
	const isEdit = assignment !== null;
	const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);

	// Re-seed the form whenever the dialog opens (create vs. a specific edit).
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (assignment ? `edit-${assignment.assignmentId}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) setForm(assignment ? assignmentToForm(assignment) : EMPTY_FORM);
	}

	// Load the catalog only while creating; edit mode has a fixed target service.
	const { data: servicesData } = useQuery({
		enabled: isOpen && !isEdit,
		queryFn: () => listServices({ limit: String(SERVICE_PICKER_LIMIT) }),
		queryKey: ['services', 'assign-picker'],
	});
	const assignedSet = new Set(assignedServiceIds);
	const options = (servicesData?.data ?? []).filter((s) => !assignedSet.has(s.id));

	const canSubmit = isEdit || form.serviceId !== '';

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		if (isEdit) {
			onUpdate({
				isPrimary: form.isPrimary,
				notes: orNull(form.notes),
				role: orNull(form.role),
			});
		} else {
			onCreate({
				isPrimary: form.isPrimary,
				notes: orNull(form.notes),
				role: orNull(form.role),
				serviceId: Number(form.serviceId),
			});
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? 'Edit service assignment' : 'Assign service'}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? `Update the role and details for "${assignment.serviceName}".`
							: 'Attach a catalog service to this asset and record its role.'}
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" noValidate onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="assign-service">Service</Label>
						{isEdit ? (
							<Input
								disabled
								id="assign-service"
								readOnly
								value={assignment.serviceName}
							/>
						) : (
							<Select
								onValueChange={(value) =>
									setForm((f) => ({ ...f, serviceId: value }))
								}
								value={form.serviceId}>
								<SelectTrigger id="assign-service">
									<SelectValue placeholder="Select a service" />
								</SelectTrigger>
								<SelectContent>
									{options.length === 0 ? (
										<SelectItem disabled value="none">
											No services available
										</SelectItem>
									) : (
										options.map((service) => (
											<SelectItem key={service.id} value={String(service.id)}>
												{service.name}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="assign-role">Role</Label>
						<Input
							autoComplete="off"
							id="assign-role"
							onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
							placeholder="e.g. Primary DNS, Backup target"
							value={form.role}
						/>
					</div>

					<div className="flex items-center gap-3">
						<Switch
							checked={form.isPrimary}
							id="assign-primary"
							onCheckedChange={(checked) =>
								setForm((f) => ({ ...f, isPrimary: checked }))
							}
						/>
						<Label htmlFor="assign-primary">Primary asset for this service</Label>
					</div>

					<div className="space-y-2">
						<Label htmlFor="assign-notes">Notes</Label>
						<Textarea
							id="assign-notes"
							onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
							rows={2}
							value={form.notes}
						/>
					</div>

					<DialogFooter>
						<Button disabled={isPending || !canSubmit} type="submit">
							{isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Assign service'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

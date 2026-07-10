import { Pencil, Plus, Trash2, Workflow } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { AssignedService } from '@/api/assets';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	useAssetServices,
	useCreateAssetService,
	useDeleteAssetService,
	useUpdateAssetService,
} from '@/hooks/assets/useAssetServices';

import { criticalityLabel, criticalityVariant } from '../assetDisplay.ts';
import { AssignServiceDialog } from '../AssignServiceDialog.tsx';
import { Field, FieldGrid, NotYetTracked, SectionCard } from './primitives.tsx';

/** One assigned service rendered as a card with its role, criticality, and actions. */
function AssignedServiceCard({
	assignment,
	canEdit,
	onDelete,
	onEdit,
}: {
	assignment: AssignedService;
	canEdit: boolean;
	onDelete: (assignment: AssignedService) => void;
	onEdit: (assignment: AssignedService) => void;
}) {
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<Link
						className="text-primary text-sm font-medium hover:underline"
						to={`/services/${assignment.serviceId}`}>
						{assignment.serviceName}
					</Link>
					{assignment.isPrimary && <Badge variant="secondary">Primary</Badge>}
					{assignment.serviceCriticality && (
						<Badge variant={criticalityVariant(assignment.serviceCriticality)}>
							{criticalityLabel(assignment.serviceCriticality)}
						</Badge>
					)}
				</div>
				{canEdit && (
					<div className="flex shrink-0 gap-1">
						<Button
							aria-label="Edit assignment"
							onClick={() => onEdit(assignment)}
							size="icon"
							variant="ghost">
							<Pencil aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							aria-label="Remove assignment"
							onClick={() => onDelete(assignment)}
							size="icon"
							variant="ghost">
							<Trash2 aria-hidden="true" className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			<FieldGrid>
				<Field label="Role" value={assignment.role} />
				<Field label="Category" value={assignment.serviceCategory} />
			</FieldGrid>
			{assignment.notes && (
				<>
					<Separator className="my-3" />
					<p className="text-muted-foreground text-sm whitespace-pre-wrap">
						{assignment.notes}
					</p>
				</>
			)}
		</div>
	);
}

/**
 * Service-assignment subsection of the asset detail Services tab. Lists the
 * catalog services assigned to the asset and, for OPERATOR+ users, exposes
 * assign / edit / unassign actions backed by the asset-services API.
 */
export function AssignedServicesSection({
	assetId,
	canEdit,
	enabled,
}: {
	assetId: number;
	canEdit: boolean;
	enabled: boolean;
}) {
	const { data, isError, isLoading } = useAssetServices(assetId, enabled);
	const assignments = data?.data ?? [];

	const createAssignment = useCreateAssetService(assetId);
	const updateAssignment = useUpdateAssetService(assetId);
	const deleteAssignment = useDeleteAssetService(assetId);

	const [isDialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<AssignedService | null>(null);
	const [pendingDelete, setPendingDelete] = useState<AssignedService | null>(null);

	function openCreate() {
		setEditing(null);
		setDialogOpen(true);
	}

	function openEdit(assignment: AssignedService) {
		setEditing(assignment);
		setDialogOpen(true);
	}

	function handleCreate(input: Parameters<typeof createAssignment.mutate>[0]) {
		createAssignment.mutate(input, { onSuccess: () => setDialogOpen(false) });
	}

	function handleUpdate(input: Parameters<typeof updateAssignment.mutate>[0]['input']) {
		if (!editing) return;
		updateAssignment.mutate(
			{ assignmentId: editing.assignmentId, input },
			{ onSuccess: () => setDialogOpen(false) }
		);
	}

	function confirmDelete() {
		if (!pendingDelete) return;
		deleteAssignment.mutate(pendingDelete.assignmentId, {
			onSuccess: () => setPendingDelete(null),
		});
	}

	return (
		<SectionCard
			action={
				canEdit ? (
					<Button onClick={openCreate} size="sm" variant="outline">
						<Plus aria-hidden="true" className="size-3.5" />
						Assign service
					</Button>
				) : undefined
			}
			description="Catalog services this asset provides or supports, with the role it plays for each."
			icon={Workflow}
			title="Assigned services">
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : isError ? (
				<NotYetTracked
					description="The services assigned to this asset could not be loaded. Try again shortly."
					icon={Workflow}
					title="Couldn't load services"
				/>
			) : assignments.length === 0 ? (
				<NotYetTracked
					description="No catalog services have been assigned to this asset yet."
					icon={Workflow}
					title="No services assigned yet"
				/>
			) : (
				<div className="space-y-3">
					{assignments.map((assignment) => (
						<AssignedServiceCard
							assignment={assignment}
							canEdit={canEdit}
							key={assignment.assignmentId}
							onDelete={setPendingDelete}
							onEdit={openEdit}
						/>
					))}
				</div>
			)}

			{canEdit && (
				<AssignServiceDialog
					assignedServiceIds={assignments.map((a) => a.serviceId)}
					assignment={editing}
					isOpen={isDialogOpen}
					isPending={createAssignment.isPending || updateAssignment.isPending}
					onCreate={handleCreate}
					onOpenChange={setDialogOpen}
					onUpdate={handleUpdate}
				/>
			)}

			<ConfirmAlertDialog
				confirmText="Remove"
				description={`Unassign the service "${pendingDelete?.serviceName ?? ''}" from this asset? This cannot be undone.`}
				isOpen={pendingDelete !== null}
				isPending={deleteAssignment.isPending}
				onConfirm={confirmDelete}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title="Remove service assignment"
			/>
		</SectionCard>
	);
}

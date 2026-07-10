import { Boxes, HardDrive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { StorageAllocation, StorageConsumer } from '@/api/assets';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	useCreateStorageAllocation,
	useDeleteStorageAllocation,
	useStorageAllocations,
	useStorageConsumers,
	useUpdateStorageAllocation,
} from '@/hooks/assets/useStorageAllocations';

import { StorageAllocationDialog } from '../StorageAllocationDialog.tsx';
import { formatRef, formatStorage, formatUsage, freeCapacityGb } from './formatters.ts';
import { Field, FieldGrid, NotYetTracked, SectionCard } from './primitives.tsx';

/** One storage allocation rendered as a labelled fact card with edit/delete actions. */
function AllocationCard({
	allocation,
	canEdit,
	onDelete,
	onEdit,
}: {
	allocation: StorageAllocation;
	canEdit: boolean;
	onDelete: (allocation: StorageAllocation) => void;
	onEdit: (allocation: StorageAllocation) => void;
}) {
	const a = allocation;
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">
						{a.name ?? a.mountPoint ?? a.storageType ?? `Allocation #${a.id}`}
					</span>
					{a.storageType && <Badge variant="secondary">{a.storageType}</Badge>}
				</div>
				{canEdit && (
					<div className="flex shrink-0 gap-1">
						<Button
							aria-label="Edit allocation"
							onClick={() => onEdit(a)}
							size="icon"
							variant="ghost">
							<Pencil aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							aria-label="Delete allocation"
							onClick={() => onDelete(a)}
							size="icon"
							variant="ghost">
							<Trash2 aria-hidden="true" className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			<FieldGrid>
				<Field label="Total capacity" value={formatStorage(a.capacityGb)} />
				<Field label="Used" value={formatUsage(a.capacityGb, a.usedGb)} />
				<Field label="Free" value={formatStorage(freeCapacityGb(a.capacityGb, a.usedGb))} />
				<Field label="Mount point" value={a.mountPoint} />
				<Field label="Storage pool" value={formatRef('Asset', a.storagePoolAssetId)} />
			</FieldGrid>
			{a.notes && (
				<>
					<Separator className="my-3" />
					<p className="text-muted-foreground text-sm whitespace-pre-wrap">{a.notes}</p>
				</>
			)}
		</div>
	);
}

/**
 * Storage-allocation subsection of the asset detail Storage tab. Lists the
 * asset's allocations (capacity, used, free, mount point, and the pool each
 * draws from) and, for OPERATOR+ users, exposes add / edit / delete actions.
 */
export function StorageAllocationsSection({
	assetId,
	canEdit,
	enabled,
}: {
	assetId: number;
	canEdit: boolean;
	enabled: boolean;
}) {
	const { data, isError, isLoading } = useStorageAllocations(assetId, enabled);
	const allocations = data?.data ?? [];

	const createAllocation = useCreateStorageAllocation(assetId);
	const updateAllocation = useUpdateStorageAllocation(assetId);
	const deleteAllocation = useDeleteStorageAllocation(assetId);

	const [isDialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<null | StorageAllocation>(null);
	const [pendingDelete, setPendingDelete] = useState<null | StorageAllocation>(null);

	function openCreate() {
		setEditing(null);
		setDialogOpen(true);
	}

	function openEdit(allocation: StorageAllocation) {
		setEditing(allocation);
		setDialogOpen(true);
	}

	function handleSubmit(input: Parameters<typeof createAllocation.mutate>[0]) {
		if (editing) {
			updateAllocation.mutate(
				{ allocationId: editing.id, input },
				{ onSuccess: () => setDialogOpen(false) }
			);
		} else {
			createAllocation.mutate(input, { onSuccess: () => setDialogOpen(false) });
		}
	}

	function confirmDelete() {
		if (!pendingDelete) return;
		deleteAllocation.mutate(pendingDelete.id, {
			onSuccess: () => setPendingDelete(null),
		});
	}

	return (
		<SectionCard
			action={
				canEdit ? (
					<Button onClick={openCreate} size="sm" variant="outline">
						<Plus aria-hidden="true" className="size-3.5" />
						Add allocation
					</Button>
				) : undefined
			}
			description="Volumes and pools this asset consumes, with total, used, and free capacity."
			icon={HardDrive}
			title="Storage allocations">
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : isError ? (
				<NotYetTracked
					description="The storage allocations for this asset could not be loaded. Try again shortly."
					icon={HardDrive}
					title="Couldn't load allocations"
				/>
			) : allocations.length === 0 ? (
				<NotYetTracked
					description="No storage allocations have been recorded for this asset yet."
					icon={HardDrive}
					title="No allocations yet"
				/>
			) : (
				<div className="space-y-3">
					{allocations.map((allocation) => (
						<AllocationCard
							allocation={allocation}
							canEdit={canEdit}
							key={allocation.id}
							onDelete={setPendingDelete}
							onEdit={openEdit}
						/>
					))}
				</div>
			)}

			{canEdit && (
				<StorageAllocationDialog
					allocation={editing}
					isOpen={isDialogOpen}
					isPending={createAllocation.isPending || updateAllocation.isPending}
					onOpenChange={setDialogOpen}
					onSubmit={handleSubmit}
				/>
			)}

			<ConfirmAlertDialog
				confirmText="Delete"
				description={`Remove the storage allocation "${
					pendingDelete?.name ??
					pendingDelete?.mountPoint ??
					pendingDelete?.storageType ??
					`#${pendingDelete?.id ?? ''}`
				}"? This cannot be undone.`}
				isOpen={pendingDelete !== null}
				isPending={deleteAllocation.isPending}
				onConfirm={confirmDelete}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title="Delete storage allocation"
			/>
		</SectionCard>
	);
}

/** One consuming allocation rendered as a compact row linking to the consumer asset. */
function ConsumerRow({ consumer }: { consumer: StorageConsumer }) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-lg border p-3">
			<div className="min-w-0">
				<Link
					className="text-sm font-medium hover:underline"
					to={`/assets/${consumer.assetId}`}>
					{consumer.consumerAssetName ?? `Asset #${consumer.assetId}`}
				</Link>
				<p className="text-muted-foreground truncate text-xs">
					{consumer.name ?? consumer.mountPoint ?? consumer.storageType ?? '—'}
				</p>
			</div>
			<div className="text-right text-sm tabular-nums">
				{formatUsage(consumer.capacityGb, consumer.usedGb)}
			</div>
		</div>
	);
}

/**
 * Read-only "assets depending on this pool" subsection. Lists the allocations
 * that draw storage from this asset acting as a pool/appliance, so operators can
 * see the downstream impact of the pool. Degrades to an empty state when nothing
 * depends on the asset.
 */
export function StorageConsumersSection({
	assetId,
	enabled,
}: {
	assetId: number;
	enabled: boolean;
}) {
	const { data, isError, isLoading } = useStorageConsumers(assetId, enabled);
	const consumers = data?.data ?? [];

	return (
		<SectionCard
			description="Assets that draw storage capacity from this asset acting as a pool or appliance."
			icon={Boxes}
			title="Assets depending on this pool">
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			) : isError ? (
				<NotYetTracked
					description="The dependent assets could not be loaded. Try again shortly."
					icon={Boxes}
					title="Couldn't load dependents"
				/>
			) : consumers.length === 0 ? (
				<NotYetTracked
					description="No other assets draw storage from this asset yet."
					icon={Boxes}
					title="No dependents yet"
				/>
			) : (
				<div className="space-y-3">
					{consumers.map((consumer) => (
						<ConsumerRow consumer={consumer} key={consumer.id} />
					))}
				</div>
			)}
		</SectionCard>
	);
}

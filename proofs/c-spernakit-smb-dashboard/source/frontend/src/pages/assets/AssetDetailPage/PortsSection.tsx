import { Pencil, Plug, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { AssetPort } from '@/api/assets';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	useAssetPorts,
	useCreateAssetPort,
	useDeleteAssetPort,
	useUpdateAssetPort,
} from '@/hooks/assets/useAssetPorts';

import { PortDialog } from '../PortDialog.tsx';
import {
	portExposureLabel,
	portExposureVariant,
	portReviewLabel,
	portReviewVariant,
	portSourceLabel,
} from '../portDisplay.ts';
import { formatDate, formatRef } from './formatters.ts';
import { Field, FieldGrid, NotYetTracked, SectionCard } from './primitives.tsx';

/** One port rendered as a labelled fact card with edit/delete actions. */
function PortCard({
	canEdit,
	onDelete,
	onEdit,
	port,
}: {
	canEdit: boolean;
	onDelete: (port: AssetPort) => void;
	onEdit: (port: AssetPort) => void;
	port: AssetPort;
}) {
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">
						{port.protocol.toUpperCase()}/{port.portNumber}
					</span>
					{port.serviceName && (
						<span className="text-muted-foreground text-sm">{port.serviceName}</span>
					)}
					<Badge variant={portReviewVariant(port.reviewState)}>
						{portReviewLabel(port.reviewState)}
					</Badge>
					<Badge variant={portExposureVariant(port.exposureLevel)}>
						{portExposureLabel(port.exposureLevel)}
					</Badge>
				</div>
				{canEdit && (
					<div className="flex shrink-0 gap-1">
						<Button
							aria-label="Edit port"
							onClick={() => onEdit(port)}
							size="icon"
							variant="ghost">
							<Pencil aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							aria-label="Delete port"
							onClick={() => onDelete(port)}
							size="icon"
							variant="ghost">
							<Trash2 aria-hidden="true" className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			<FieldGrid>
				<Field label="Service" value={formatRef('Service', port.serviceId)} />
				<Field label="Source" value={portSourceLabel(port.source)} />
				<Field label="Scope" value={port.scope} />
				<Field label="Last verified" value={formatDate(port.verifiedAt)} />
			</FieldGrid>
			{port.notes && (
				<>
					<Separator className="my-3" />
					<p className="text-muted-foreground text-sm whitespace-pre-wrap">
						{port.notes}
					</p>
				</>
			)}
		</div>
	);
}

/**
 * Port subsection of the asset detail Ports tab. Lists the asset's documented
 * and observed open ports and, for OPERATOR+ users, exposes add / edit / delete
 * actions backed by the asset-ports API.
 */
export function PortsSection({
	assetId,
	canEdit,
	enabled,
}: {
	assetId: number;
	canEdit: boolean;
	enabled: boolean;
}) {
	const { data, isError, isLoading } = useAssetPorts(assetId, enabled);
	const ports = data?.data ?? [];

	const createPort = useCreateAssetPort(assetId);
	const updatePort = useUpdateAssetPort(assetId);
	const deletePort = useDeleteAssetPort(assetId);

	const [isDialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<AssetPort | null>(null);
	const [pendingDelete, setPendingDelete] = useState<AssetPort | null>(null);

	function openCreate() {
		setEditing(null);
		setDialogOpen(true);
	}

	function openEdit(port: AssetPort) {
		setEditing(port);
		setDialogOpen(true);
	}

	function handleSubmit(input: Parameters<typeof createPort.mutate>[0]) {
		if (editing) {
			updatePort.mutate(
				{ input, portId: editing.id },
				{ onSuccess: () => setDialogOpen(false) }
			);
		} else {
			createPort.mutate(input, { onSuccess: () => setDialogOpen(false) });
		}
	}

	function confirmDelete() {
		if (!pendingDelete) return;
		deletePort.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
	}

	return (
		<SectionCard
			action={
				canEdit ? (
					<Button onClick={openCreate} size="sm" variant="outline">
						<Plus aria-hidden="true" className="size-3.5" />
						Add port
					</Button>
				) : undefined
			}
			description="Expected and observed open ports, their exposure level, and review status."
			icon={Plug}
			title="Ports">
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : isError ? (
				<NotYetTracked
					description="The ports for this asset could not be loaded. Try again shortly."
					icon={Plug}
					title="Couldn't load ports"
				/>
			) : ports.length === 0 ? (
				<NotYetTracked
					description="No ports have been recorded for this asset yet."
					icon={Plug}
					title="No ports yet"
				/>
			) : (
				<div className="space-y-3">
					{ports.map((port) => (
						<PortCard
							canEdit={canEdit}
							key={port.id}
							onDelete={setPendingDelete}
							onEdit={openEdit}
							port={port}
						/>
					))}
				</div>
			)}

			{canEdit && (
				<PortDialog
					isOpen={isDialogOpen}
					isPending={createPort.isPending || updatePort.isPending}
					onOpenChange={setDialogOpen}
					onSubmit={handleSubmit}
					port={editing}
				/>
			)}

			<ConfirmAlertDialog
				confirmText="Delete"
				description={`Remove the port "${
					pendingDelete
						? `${pendingDelete.protocol.toUpperCase()}/${pendingDelete.portNumber}`
						: ''
				}"? This cannot be undone.`}
				isOpen={pendingDelete !== null}
				isPending={deletePort.isPending}
				onConfirm={confirmDelete}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title="Delete port"
			/>
		</SectionCard>
	);
}

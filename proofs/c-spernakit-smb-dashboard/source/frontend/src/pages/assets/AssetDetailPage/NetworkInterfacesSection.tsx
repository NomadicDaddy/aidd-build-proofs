import { Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { NetworkInterface } from '@/api/assets';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	useCreateNetworkInterface,
	useDeleteNetworkInterface,
	useNetworkInterfaces,
	useUpdateNetworkInterface,
} from '@/hooks/assets/useNetworkInterfaces';

import { NetworkInterfaceDialog } from '../NetworkInterfaceDialog.tsx';
import { formatRef, formatVlan } from './formatters.ts';
import { Field, FieldGrid, NotYetTracked, SectionCard } from './primitives.tsx';

/** One network interface rendered as a labelled fact card with edit/delete actions. */
function InterfaceCard({
	canEdit,
	networkInterface,
	onDelete,
	onEdit,
}: {
	canEdit: boolean;
	networkInterface: NetworkInterface;
	onDelete: (iface: NetworkInterface) => void;
	onEdit: (iface: NetworkInterface) => void;
}) {
	const iface = networkInterface;
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">
						{iface.name ??
							iface.ipAddress ??
							iface.macAddress ??
							`Interface #${iface.id}`}
					</span>
					{iface.isPrimary && <Badge variant="secondary">Primary</Badge>}
				</div>
				{canEdit && (
					<div className="flex shrink-0 gap-1">
						<Button
							aria-label="Edit interface"
							onClick={() => onEdit(iface)}
							size="icon"
							variant="ghost">
							<Pencil aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							aria-label="Delete interface"
							onClick={() => onDelete(iface)}
							size="icon"
							variant="ghost">
							<Trash2 aria-hidden="true" className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			<FieldGrid>
				<Field label="IP address" value={iface.ipAddress} />
				<Field label="MAC address" value={iface.macAddress} />
				<Field label="Subnet mask" value={iface.subnetMask} />
				<Field label="Gateway" value={iface.gateway} />
				<Field label="VLAN" value={formatVlan(iface.vlanId)} />
				<Field label="DNS name" value={iface.dnsName} />
				<Field label="Network zone" value={formatRef('Zone', iface.networkZoneId)} />
			</FieldGrid>
			{iface.notes && (
				<>
					<Separator className="my-3" />
					<p className="text-muted-foreground text-sm whitespace-pre-wrap">
						{iface.notes}
					</p>
				</>
			)}
		</div>
	);
}

/**
 * Network-interface subsection of the asset detail Network tab. Lists the
 * asset's interfaces and, for OPERATOR+ users, exposes add / edit / delete
 * actions backed by the network-interface API.
 */
export function NetworkInterfacesSection({
	assetId,
	canEdit,
	enabled,
}: {
	assetId: number;
	canEdit: boolean;
	enabled: boolean;
}) {
	const { data, isError, isLoading } = useNetworkInterfaces(assetId, enabled);
	const interfaces = data?.data ?? [];

	const createInterface = useCreateNetworkInterface(assetId);
	const updateInterface = useUpdateNetworkInterface(assetId);
	const deleteInterface = useDeleteNetworkInterface(assetId);

	const [isDialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<NetworkInterface | null>(null);
	const [pendingDelete, setPendingDelete] = useState<NetworkInterface | null>(null);

	function openCreate() {
		setEditing(null);
		setDialogOpen(true);
	}

	function openEdit(iface: NetworkInterface) {
		setEditing(iface);
		setDialogOpen(true);
	}

	function handleSubmit(input: Parameters<typeof createInterface.mutate>[0]) {
		if (editing) {
			updateInterface.mutate(
				{ input, interfaceId: editing.id },
				{ onSuccess: () => setDialogOpen(false) }
			);
		} else {
			createInterface.mutate(input, { onSuccess: () => setDialogOpen(false) });
		}
	}

	function confirmDelete() {
		if (!pendingDelete) return;
		deleteInterface.mutate(pendingDelete.id, {
			onSuccess: () => setPendingDelete(null),
		});
	}

	return (
		<SectionCard
			action={
				canEdit ? (
					<Button onClick={openCreate} size="sm" variant="outline">
						<Plus aria-hidden="true" className="size-3.5" />
						Add interface
					</Button>
				) : undefined
			}
			description="Per-interface MAC, IP, subnet, gateway, VLAN, DNS, and network-zone records."
			icon={Network}
			title="Network interfaces">
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : isError ? (
				<NotYetTracked
					description="The network interfaces for this asset could not be loaded. Try again shortly."
					icon={Network}
					title="Couldn't load interfaces"
				/>
			) : interfaces.length === 0 ? (
				<NotYetTracked
					description="No network interfaces have been recorded for this asset yet."
					icon={Network}
					title="No interfaces yet"
				/>
			) : (
				<div className="space-y-3">
					{interfaces.map((iface) => (
						<InterfaceCard
							canEdit={canEdit}
							key={iface.id}
							networkInterface={iface}
							onDelete={setPendingDelete}
							onEdit={openEdit}
						/>
					))}
				</div>
			)}

			{canEdit && (
				<NetworkInterfaceDialog
					isOpen={isDialogOpen}
					isPending={createInterface.isPending || updateInterface.isPending}
					networkInterface={editing}
					onOpenChange={setDialogOpen}
					onSubmit={handleSubmit}
				/>
			)}

			<ConfirmAlertDialog
				confirmText="Delete"
				description={`Remove the network interface "${
					pendingDelete?.name ??
					pendingDelete?.ipAddress ??
					pendingDelete?.macAddress ??
					`#${pendingDelete?.id ?? ''}`
				}"? This cannot be undone.`}
				isOpen={pendingDelete !== null}
				isPending={deleteInterface.isPending}
				onConfirm={confirmDelete}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title="Delete network interface"
			/>
		</SectionCard>
	);
}

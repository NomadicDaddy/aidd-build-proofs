import { Boxes, Pencil, Server } from 'lucide-react';

import type { Asset, HardwareProfile } from '@/api/assets';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { formatCount, formatMemory, formatRef } from './formatters.ts';
import { Field, FieldGrid, SectionCard } from './primitives.tsx';

/** The Virtualization tab: placement, guest details, and physical-host facts. */
export function VirtualizationTab({
	asset,
	canEdit,
	onEditProfile,
	profile,
}: {
	asset: Asset;
	canEdit: boolean;
	onEditProfile: () => void;
	profile: HardwareProfile | null;
}) {
	return (
		<>
			<SectionCard
				action={
					canEdit ? (
						<Button onClick={onEditProfile} size="sm" variant="outline">
							<Pencil aria-hidden="true" className="size-3.5" />
							Edit profile
						</Button>
					) : undefined
				}
				description="Physical/virtual placement, guest details, and host relationship."
				icon={Server}
				title="Virtualization">
				<FieldGrid>
					<Field
						label="Virtualization state"
						value={asset.isVirtual ? 'Virtual machine' : 'Physical'}
					/>
					<Field label="Platform / hypervisor" value={asset.platform} />
					<Field label="Host" value={formatRef('Asset', asset.parentHostId)} />
					<Field label="Role" value={asset.role} />
					<Field label="Guest OS" value={profile?.guestOs ?? null} />
					<Field label="vCPU" value={formatCount(profile?.vcpuCount ?? null)} />
					<Field label="vRAM" value={formatMemory(profile?.ramMb ?? null)} />
					<Field label="Cluster" value={profile?.clusterName ?? null} />
					<Field label="VM tools status" value={profile?.vmToolsStatus ?? null} />
				</FieldGrid>
				{profile?.snapshotNotes && (
					<>
						<Separator className="my-4" />
						<div className="space-y-0.5">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								Snapshot notes
							</p>
							<p className="text-sm whitespace-pre-wrap">{profile.snapshotNotes}</p>
						</div>
					</>
				)}
			</SectionCard>

			<SectionCard
				description="Chassis and host-role facts for a physical hypervisor host."
				icon={Boxes}
				title="Physical host">
				<FieldGrid>
					<Field label="Chassis / model" value={profile?.chassisModel ?? null} />
					<Field label="Form factor" value={profile?.formFactor ?? null} />
					<Field label="Host role" value={profile?.hostRole ?? null} />
					<Field label="Cluster" value={profile?.clusterName ?? null} />
				</FieldGrid>
			</SectionCard>
		</>
	);
}

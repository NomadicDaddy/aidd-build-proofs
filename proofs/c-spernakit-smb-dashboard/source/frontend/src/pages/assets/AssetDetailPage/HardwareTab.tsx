import { Cpu, Info, Pencil } from 'lucide-react';

import type { Asset, HardwareProfile } from '@/api/assets';

import { Button } from '@/components/ui/button';

import { formatCount, formatDate, formatMemory, formatRef, formatStorage } from './formatters.ts';
import { Field, FieldGrid, SectionCard } from './primitives.tsx';

/** The Hardware tab: compute & memory profile plus platform & lifecycle facts. */
export function HardwareTab({
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
				description="CPU, memory, and storage resources recorded for this asset."
				icon={Cpu}
				title="Compute & memory">
				<FieldGrid>
					<Field label="CPU model" value={profile?.cpuModel ?? null} />
					<Field label="CPU cores" value={formatCount(profile?.cpuCores ?? null)} />
					<Field label="CPU sockets" value={formatCount(profile?.cpuSockets ?? null)} />
					<Field label="CPU threads" value={formatCount(profile?.cpuThreads ?? null)} />
					<Field label="Memory" value={formatMemory(profile?.ramMb ?? null)} />
					<Field
						label="Total storage"
						value={formatStorage(profile?.totalStorageGb ?? null)}
					/>
					<Field label="Hardware model" value={profile?.hardwareModel ?? null} />
					<Field label="Hypervisor" value={profile?.hypervisor ?? null} />
				</FieldGrid>
			</SectionCard>

			<SectionCard
				description="Operating system, identifiers, and lifecycle facts recorded on the asset."
				icon={Info}
				title="Platform & lifecycle">
				<FieldGrid>
					<Field label="Operating system" value={asset.operatingSystem} />
					<Field label="OS version" value={asset.osVersion} />
					<Field label="Platform" value={asset.platform} />
					<Field label="Serial number" value={asset.serialNumber} />
					<Field label="Asset tag" value={asset.assetTag} />
					<Field label="Vendor" value={formatRef('Vendor', asset.vendorId)} />
					<Field label="Purchase date" value={formatDate(asset.purchaseDate)} />
					<Field label="Warranty expires" value={formatDate(asset.warrantyExpiresAt)} />
					<Field label="Support ends" value={formatDate(asset.supportEndsAt)} />
					<Field
						label="Planned replacement"
						value={formatDate(asset.plannedReplacementAt)}
					/>
					<Field label="Decommissioned" value={formatDate(asset.decommissionedAt)} />
				</FieldGrid>
			</SectionCard>
		</>
	);
}

import { Cpu, Database, HardDrive, MemoryStick, Network } from 'lucide-react';

import type {
	CapacitySummary,
	StorageSummary,
	VirtualizationSummary,
} from '@/api/infrastructureSummary';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Format a raw megabyte figure into a human GB/TB string. */
function formatRam(totalMb: number): string {
	if (totalMb <= 0) return '0 GB';
	const gb = totalMb / 1024;
	if (gb >= 1024)
		return `${(gb / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} TB`;
	return `${Math.round(gb).toLocaleString()} GB`;
}

/** Format a raw gigabyte figure into a human GB/TB string. */
function formatStorage(totalGb: number): string {
	if (totalGb <= 0) return '0 GB';
	if (totalGb >= 1024)
		return `${(totalGb / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} TB`;
	return `${totalGb.toLocaleString()} GB`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-3">
			<div className="text-muted-foreground">{icon}</div>
			<div>
				<div className="text-lg font-semibold tabular-nums">{value}</div>
				<div className="text-muted-foreground text-xs">{label}</div>
			</div>
		</div>
	);
}

/** Aggregate compute/memory/storage capacity plus the virtualization breakdown. */
function CapacityVirtualization({
	capacity,
	storage,
	virtualization,
}: {
	capacity: CapacitySummary;
	storage: StorageSummary;
	virtualization: VirtualizationSummary;
}) {
	const iconClass = 'size-5';
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">Capacity</CardTitle>
					<CardDescription>
						Summed across {capacity.profiledAssets.toLocaleString()} profiled asset
						{capacity.profiledAssets === 1 ? '' : 's'}.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-3 gap-4">
					<Metric
						icon={<Cpu aria-hidden="true" className={iconClass} />}
						label="CPU cores"
						value={capacity.totalCpuCores.toLocaleString()}
					/>
					<Metric
						icon={<MemoryStick aria-hidden="true" className={iconClass} />}
						label="Memory"
						value={formatRam(capacity.totalRamMb)}
					/>
					<Metric
						icon={<HardDrive aria-hidden="true" className={iconClass} />}
						label="Storage"
						value={formatStorage(capacity.totalStorageGb)}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">Virtualization</CardTitle>
					<CardDescription>Physical vs virtual makeup of the estate.</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4">
					<Metric
						icon={<Network aria-hidden="true" className={iconClass} />}
						label="Physical assets"
						value={virtualization.physical.toLocaleString()}
					/>
					<Metric
						icon={<Network aria-hidden="true" className={iconClass} />}
						label="Virtual assets"
						value={virtualization.virtual.toLocaleString()}
					/>
					<Metric
						icon={<Network aria-hidden="true" className={iconClass} />}
						label="Hypervisor hosts"
						value={virtualization.hypervisorHosts.toLocaleString()}
					/>
					<Metric
						icon={<Network aria-hidden="true" className={iconClass} />}
						label="VMs without a host"
						value={virtualization.orphanVirtual.toLocaleString()}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">Storage</CardTitle>
					<CardDescription>
						Allocated across {storage.allocationCount.toLocaleString()} allocation
						{storage.allocationCount === 1 ? '' : 's'}
						{storage.poolCount > 0
							? ` and ${storage.poolCount.toLocaleString()} pool${
									storage.poolCount === 1 ? '' : 's'
								}`
							: ''}
						.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-3 gap-4">
					<Metric
						icon={<Database aria-hidden="true" className={iconClass} />}
						label="Total capacity"
						value={formatStorage(storage.totalCapacityGb)}
					/>
					<Metric
						icon={<HardDrive aria-hidden="true" className={iconClass} />}
						label="Used"
						value={formatStorage(storage.totalUsedGb)}
					/>
					<Metric
						icon={<HardDrive aria-hidden="true" className={iconClass} />}
						label="Free"
						value={formatStorage(storage.totalFreeGb)}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

export { CapacityVirtualization };

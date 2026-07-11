import { Cpu, HardDrive, Network, Wifi } from 'lucide-react';

import type { DashboardData } from '@/api/types';

import { StatCard } from '@/components/shared/charts/StatCard';
import { StatCardSkeleton } from '@/components/shared/skeletons/StatCardSkeleton';

function SystemMetrics({
	data,
	isLoading,
}: {
	data: DashboardData | undefined;
	isLoading: boolean;
}) {
	return (
		<>
			<div>
				<h2 className="text-lg font-semibold">System Metrics</h2>
				<p className="text-muted-foreground mt-1 text-sm">Real-time resource usage</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{isLoading ? (
					<>
						<StatCardSkeleton />
						<StatCardSkeleton />
						<StatCardSkeleton />
						<StatCardSkeleton />
					</>
				) : (
					<>
						<StatCard
							icon={
								<HardDrive
									aria-hidden="true"
									className="text-muted-foreground size-5"
								/>
							}
							progress={Math.min(data?.metrics.memoryUsage ?? 0, 100)}
							title="Memory Usage"
							value={`${data?.metrics.memoryUsage ?? 0}%`}
						/>
						<StatCard
							icon={
								<Cpu aria-hidden="true" className="text-muted-foreground size-5" />
							}
							progress={Math.min(data?.metrics.cpuUsage ?? 0, 100)}
							title="CPU Usage"
							value={`${data?.metrics.cpuUsage ?? 0}%`}
						/>
						<StatCard
							icon={
								<Network
									aria-hidden="true"
									className="text-muted-foreground size-5"
								/>
							}
							title="Request Count"
							value={data?.metrics.requestCount ?? 0}
						/>
						<StatCard
							icon={
								<Wifi aria-hidden="true" className="text-muted-foreground size-5" />
							}
							title="Active Connections"
							value={data?.metrics.activeConnections ?? 0}
						/>
					</>
				)}
			</div>
		</>
	);
}

export { SystemMetrics };

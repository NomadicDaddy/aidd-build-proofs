import { AlertTriangle, Boxes, MonitorSmartphone, Server } from 'lucide-react';

import type { InfrastructureSummary } from '@/api/infrastructureSummary';

import { StatCard } from '@/components/shared/charts/StatCard';
import { StatCardSkeleton } from '@/components/shared/skeletons/StatCardSkeleton';

/** Total of every operational risk cue — drives the headline "open risks" card. */
function totalRisks(risks: InfrastructureSummary['risks']): number {
	return (
		risks.criticalWithoutBackup +
		risks.internetExposedPorts +
		risks.unknownPorts +
		risks.unownedAssets +
		risks.unsupportedOs
	);
}

/** Headline stat cards: inventory size, physical/virtual split, and open risks. */
function StatOverview({
	isLoading,
	summary,
}: {
	isLoading: boolean;
	summary: InfrastructureSummary | undefined;
}) {
	if (isLoading || !summary) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCardSkeleton />
				<StatCardSkeleton />
				<StatCardSkeleton />
				<StatCardSkeleton />
			</div>
		);
	}

	const { risks, virtualization } = summary;
	const risksOpen = totalRisks(risks);
	const iconClass = 'text-muted-foreground size-5';

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				icon={<Boxes aria-hidden="true" className={iconClass} />}
				index={0}
				subtitle="Live, non-deleted records"
				title="Total Assets"
				value={summary.totalAssets.toLocaleString()}
			/>
			<StatCard
				icon={<Server aria-hidden="true" className={iconClass} />}
				index={1}
				subtitle={`${virtualization.virtual.toLocaleString()} virtual`}
				title="Physical Servers"
				value={virtualization.physical.toLocaleString()}
			/>
			<StatCard
				icon={<MonitorSmartphone aria-hidden="true" className={iconClass} />}
				index={2}
				subtitle="Virtualization platforms"
				title="Hypervisor Hosts"
				value={virtualization.hypervisorHosts.toLocaleString()}
			/>
			<StatCard
				icon={<AlertTriangle aria-hidden="true" className={iconClass} />}
				index={3}
				subtitle="Across all risk cues"
				title="Open Risks"
				value={risksOpen.toLocaleString()}
				variant={risksOpen > 0 ? 'warning' : 'success'}
			/>
		</div>
	);
}

export { StatOverview };

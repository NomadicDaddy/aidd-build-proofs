import { ServerCog, ShieldAlert } from 'lucide-react';

import type { DocumentationHealthSummary } from '@/api/documentationHealth';
import type { InfrastructureSummary } from '@/api/infrastructureSummary';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentationHealth } from '@/hooks/dashboards/useDocumentationHealth';
import { useInfrastructureSummary } from '@/hooks/dashboards/useInfrastructureSummary';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { cn } from '@/lib/utils';

import type { SectionKey } from './dashboardViews';

import { BreakdownList } from './BreakdownList';
import { CapacityVirtualization } from './CapacityVirtualization';
import {
	critLabel,
	DASHBOARD_VIEWS,
	DEFAULT_VIEW_ID,
	resolveView,
	statusLabel,
	typeLabel,
} from './dashboardViews';
import { DocumentationHealthCard } from './DocumentationHealth';
import { RiskCard, ServicesCard } from './ServicesRisk';
import { StatOverview } from './StatOverview';

/** The five "counts by dimension" cards, prettifying enum labels where needed. */
function BreakdownGrid({ summary }: { summary: InfrastructureSummary }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<BreakdownList
				buckets={summary.byType}
				formatLabel={(key) => typeLabel(key)}
				title="By Type"
			/>
			<BreakdownList
				buckets={summary.byStatus}
				formatLabel={(key) => statusLabel(key)}
				title="By Status"
			/>
			<BreakdownList
				buckets={summary.byCriticality}
				formatLabel={(key) => critLabel(key)}
				title="By Criticality"
			/>
			<BreakdownList buckets={summary.bySite} title="By Site" />
			<BreakdownList buckets={summary.byOwner} title="By Owner" />
		</div>
	);
}

interface SectionContext {
	health: DocumentationHealthSummary | undefined;
	healthLoading: boolean;
	isLoading: boolean;
	summary: InfrastructureSummary;
}

/** Render a single dashboard section by its key using the loaded summary. */
function renderSection(key: SectionKey, ctx: SectionContext) {
	const { health, healthLoading, isLoading, summary } = ctx;
	switch (key) {
		case 'breakdown':
			return <BreakdownGrid summary={summary} />;
		case 'capacity':
			return (
				<CapacityVirtualization
					capacity={summary.capacity}
					storage={summary.storage}
					virtualization={summary.virtualization}
				/>
			);
		case 'health':
			return <DocumentationHealthCard health={health} isLoading={healthLoading} />;
		case 'overview':
			return <StatOverview isLoading={isLoading} summary={summary} />;
		case 'risk':
			return <RiskCard risks={summary.risks} />;
		case 'services':
			return <ServicesCard topServices={summary.topServices} />;
	}
}

/** Segmented control that switches between the saved management/ops/audit views. */
function ViewSwitcher({
	activeId,
	onSelect,
}: {
	activeId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
			{DASHBOARD_VIEWS.map((view) => {
				const active = view.id === activeId;
				return (
					<button
						aria-pressed={active}
						className={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							active
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
						key={view.id}
						onClick={() => onSelect(view.id)}
						title={view.description}
						type="button">
						{view.label}
					</button>
				);
			})}
		</div>
	);
}

function InfrastructureDashboardPage() {
	const { hasMinRole } = useAuthorization();
	const hasAccess = hasMinRole('VIEWER');
	const { getFilter, setFilter } = useUrlFilters();
	const { isError, isLoading, summary } = useInfrastructureSummary(hasAccess);
	const { health, isLoading: healthLoading } = useDocumentationHealth(hasAccess);

	const activeView = resolveView(getFilter('view', DEFAULT_VIEW_ID));

	const header = (
		<PageHeader
			description="Operational overview of your infrastructure inventory and risk."
			icon={ServerCog}
			title="Infrastructure Dashboard">
			{hasAccess && (
				<ViewSwitcher
					activeId={activeView.id}
					onSelect={(id) => setFilter('view', id === DEFAULT_VIEW_ID ? '' : id)}
				/>
			)}
		</PageHeader>
	);

	if (!hasAccess || (isError && !summary)) {
		return (
			<div className="space-y-6 p-6">
				{header}
				<EmptyState
					description="The infrastructure dashboard requires at least viewer access. Contact an administrator if you need it."
					icon={ShieldAlert}
					title="Access required"
				/>
			</div>
		);
	}

	if (isLoading || !summary) {
		return (
			<div className="space-y-6 p-6">
				{header}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton className="h-28 w-full" key={i} />
					))}
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			{header}
			<p className="text-muted-foreground -mt-2 text-sm">{activeView.description}</p>
			{activeView.sections.map((key) => (
				<section key={key}>
					{renderSection(key, { health, healthLoading, isLoading, summary })}
				</section>
			))}
		</div>
	);
}

export { InfrastructureDashboardPage };

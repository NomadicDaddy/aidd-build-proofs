import { useQuery } from '@tanstack/react-query';
import {
	AlertTriangle,
	BookOpenText,
	FilePlus2,
	Gauge,
	type LucideIcon,
	Percent,
	ReceiptText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PricingDashboardData, ScenarioListItem, ScenarioRiskFlag } from '@/api/types';

import { getPricingDashboard } from '@/api/pricingDashboard';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useAuthorization } from '@/hooks/useAuthorization';
import { formatCurrency, formatPercent } from '@/lib/pricingFormatters';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<ScenarioListItem['status'], string> = {
	approved: 'Approved',
	archived: 'Archived',
	draft: 'Draft',
	review: 'Review',
};

const RISK_LABELS: Record<ScenarioRiskFlag['code'], string> = {
	below_target_margin: 'Below target',
	high_discount: 'High discount',
	missing_contingency: 'No contingency',
	stale_catalog_assumption: 'Stale catalog',
};

interface MetricCardProps {
	description: string;
	icon: LucideIcon;
	tone?: 'default' | 'warning';
	value: string;
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

function MetricCard({ description, icon: Icon, tone = 'default', value }: MetricCardProps) {
	return (
		<Card
			className={cn(
				'gap-4 rounded-lg py-5',
				tone === 'warning' &&
					'border-amber-300/80 bg-amber-50/60 dark:border-amber-700/70 dark:bg-amber-950/25'
			)}>
			<CardHeader className="gap-3 px-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="text-muted-foreground text-sm font-medium">
							{description}
						</CardTitle>
						<div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
					</div>
					<div
						className={cn(
							'bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-md',
							tone === 'warning' &&
								'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
						)}>
						<Icon aria-hidden="true" className="size-4" />
					</div>
				</div>
			</CardHeader>
		</Card>
	);
}

function RiskFlags({ flags }: { flags: ScenarioRiskFlag[] }) {
	if (flags.length === 0) {
		return <span className="text-muted-foreground">None</span>;
	}

	return (
		<div className="flex flex-wrap justify-end gap-1">
			{flags.map((flag) => (
				<Badge
					className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-200"
					key={flag.code}
					title={flag.message}
					variant="outline">
					{RISK_LABELS[flag.code]}
				</Badge>
			))}
		</div>
	);
}

function RecentScenariosTable({ scenarios }: { scenarios: ScenarioListItem[] }) {
	return (
		<div className="rounded-md border">
			<Table className="min-w-[58rem]">
				<TableHeader>
					<TableRow>
						<TableHead>Scenario</TableHead>
						<TableHead>Status</TableHead>
						<TableHead className="text-right">Total Price</TableHead>
						<TableHead className="text-right">Margin</TableHead>
						<TableHead className="text-right">Risks</TableHead>
						<TableHead>Updated</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{scenarios.map((scenario) => (
						<TableRow key={scenario.id}>
							<TableCell>
								<Link
									className="hover:text-primary block max-w-[24rem] min-w-0 transition-colors"
									to={`/scenarios/${scenario.id}`}>
									<span className="block truncate font-medium">
										{scenario.title}
									</span>
									<span className="text-muted-foreground block truncate text-xs">
										{scenario.customerName}
									</span>
								</Link>
							</TableCell>
							<TableCell>
								<Badge variant="secondary">{STATUS_LABELS[scenario.status]}</Badge>
							</TableCell>
							<TableCell className="text-right">
								{formatCurrency(scenario.finalPrice)}
							</TableCell>
							<TableCell className="text-right">
								{formatPercent(scenario.marginPercent, 'Not priced')}
							</TableCell>
							<TableCell className="text-right">
								<RiskFlags flags={scenario.riskFlags} />
							</TableCell>
							<TableCell>{formatDate(scenario.updatedAt)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function DashboardContent({ data }: { data: PricingDashboardData }) {
	return (
		<>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					description="Saved scenarios"
					icon={ReceiptText}
					value={String(data.totalScenarios)}
				/>
				<MetricCard
					description="Draft scenarios"
					icon={BookOpenText}
					value={String(data.draftCount)}
				/>
				<MetricCard
					description="Below target"
					icon={AlertTriangle}
					tone={data.belowTargetCount > 0 ? 'warning' : 'default'}
					value={String(data.belowTargetCount)}
				/>
				<MetricCard
					description="Average gross margin"
					icon={Percent}
					value={formatPercent(data.averageMarginPercent, 'Not priced')}
				/>
			</div>

			<Card className="gap-4 rounded-lg">
				<CardHeader className="flex flex-col gap-3 px-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle>Recent Scenarios</CardTitle>
						<p className="text-muted-foreground text-sm">
							Latest active scenarios with current pricing and risk signals.
						</p>
					</div>
					<Button asChild size="sm" variant="outline">
						<Link to="/scenarios">View all</Link>
					</Button>
				</CardHeader>
				<CardContent className="px-5">
					{data.recentScenarios.length > 0 ? (
						<RecentScenariosTable scenarios={data.recentScenarios} />
					) : (
						<EmptyState
							description="Create a scenario to start tracking quote margin health."
							icon={ReceiptText}
							title="No active scenarios"
						/>
					)}
				</CardContent>
			</Card>
		</>
	);
}

function DashboardPage() {
	const { hasMinRole } = useAuthorization();
	const hasAccess = hasMinRole('VIEWER');
	const { data, isError, isLoading } = useQuery({
		enabled: hasAccess,
		queryFn: getPricingDashboard,
		queryKey: ['pricing-dashboard'],
		throwOnError: false,
	});
	const dashboard = data?.data;

	if (!hasAccess) {
		return (
			<div className="space-y-6 p-6">
				<PageHeader
					description="Pricing health, recent scenarios, and margin risk."
					icon={Gauge}
					title="Dashboard"
				/>
				<EmptyState
					description="Dashboard pricing metrics require viewer access or higher."
					icon={Gauge}
					title="Access required"
				/>
			</div>
		);
	}

	return (
		<div className="space-y-5 p-6">
			<PageHeader
				description="Pricing health, recent scenarios, and margin risk."
				icon={Gauge}
				title="Dashboard">
				<Button asChild variant="outline">
					<Link to="/cost-catalog">
						<BookOpenText aria-hidden="true" className="size-4" />
						Cost Catalog
					</Link>
				</Button>
				<Button asChild>
					<Link to="/scenarios/new">
						<FilePlus2 aria-hidden="true" className="size-4" />
						New Scenario
					</Link>
				</Button>
			</PageHeader>

			{isLoading && <div className="text-muted-foreground text-sm">Loading dashboard...</div>}

			{isError && !dashboard && (
				<EmptyState
					description="Pricing dashboard data could not be loaded."
					icon={AlertTriangle}
					title="Dashboard unavailable"
				/>
			)}

			{dashboard && <DashboardContent data={dashboard} />}
		</div>
	);
}

export { DashboardPage };

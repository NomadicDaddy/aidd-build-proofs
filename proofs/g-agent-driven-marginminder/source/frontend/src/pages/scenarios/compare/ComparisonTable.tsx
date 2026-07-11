import type { ScenarioComparisonItem, ScenarioRiskFlag } from '@/api/types';

import { Badge } from '@/components/ui/badge';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/lib/pricingFormatters';
import { cn } from '@/lib/utils';

import type { ComparisonMetric } from './types';

import { RISK_LABELS } from './types';

function RiskFlagBadges({ flags }: { flags: ScenarioRiskFlag[] }) {
	if (flags.length === 0) {
		return <span className="text-muted-foreground">None</span>;
	}

	return (
		<div className="flex min-w-56 flex-wrap justify-end gap-1">
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

const COMPARISON_METRICS: ComparisonMetric[] = [
	{
		getClassName: () => 'font-semibold text-foreground',
		label: 'Final price',
		renderValue: (scenario) => formatCurrency(scenario.summary.finalPrice),
	},
	{
		label: 'Direct cost',
		renderValue: (scenario) => formatCurrency(scenario.summary.directCost),
	},
	{
		label: 'Gross profit',
		renderValue: (scenario) => formatCurrency(scenario.summary.grossProfit),
	},
	{
		getClassName: (scenario) =>
			scenario.summary.targetMarginGap !== null && scenario.summary.targetMarginGap < 0
				? 'text-amber-700 dark:text-amber-300'
				: '',
		label: 'Margin percentage',
		renderValue: (scenario) => formatPercent(scenario.summary.marginPercent),
	},
	{
		getClassName: (scenario) =>
			scenario.summary.targetMarginGap === null
				? ''
				: scenario.summary.targetMarginGap < 0
					? 'text-amber-700 dark:text-amber-300'
					: 'text-emerald-700 dark:text-emerald-300',
		label: 'Target margin gap',
		renderValue: (scenario) => formatPercent(scenario.summary.targetMarginGap),
	},
	{
		label: 'Discount amount',
		renderValue: (scenario) => formatCurrency(scenario.summary.discountAmount),
	},
	{
		label: 'Contingency amount',
		renderValue: (scenario) => formatCurrency(scenario.summary.contingencyAmount),
	},
];

function ComparisonTable({ scenarios }: { scenarios: ScenarioComparisonItem[] }) {
	return (
		<div className="rounded-md border">
			<Table className="min-w-[64rem]">
				<TableHeader>
					<TableRow>
						<TableHead className="bg-card sticky left-0 z-10 w-48">Metric</TableHead>
						{scenarios.map((scenario) => (
							<TableHead className="min-w-64 text-right" key={scenario.id}>
								<div className="space-y-1">
									<div className="truncate font-semibold">{scenario.title}</div>
									<div className="text-muted-foreground truncate text-xs font-normal">
										{scenario.customerName}
									</div>
								</div>
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{COMPARISON_METRICS.map((metric) => (
						<TableRow key={metric.label}>
							<TableCell className="bg-card sticky left-0 z-10 font-medium">
								{metric.label}
							</TableCell>
							{scenarios.map((scenario) => (
								<TableCell
									className={cn(
										'text-right tabular-nums',
										metric.getClassName?.(scenario)
									)}
									key={scenario.id}>
									{metric.renderValue(scenario)}
								</TableCell>
							))}
						</TableRow>
					))}
					<TableRow>
						<TableCell className="bg-card sticky left-0 z-10 font-medium">
							Risk flags
						</TableCell>
						{scenarios.map((scenario) => (
							<TableCell className="text-right whitespace-normal" key={scenario.id}>
								<RiskFlagBadges flags={scenario.summary.riskFlags} />
							</TableCell>
						))}
					</TableRow>
				</TableBody>
			</Table>
		</div>
	);
}

export { ComparisonTable };

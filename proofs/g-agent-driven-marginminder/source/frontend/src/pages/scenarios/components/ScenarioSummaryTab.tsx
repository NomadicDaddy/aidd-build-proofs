import { Copy } from 'lucide-react';

import type { ScenarioSummary } from '@/api/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatPercent } from '@/lib/pricingFormatters';
import { cn } from '@/lib/utils';

import { useScenarioForm } from './ScenarioFormContext';
import { RiskFlagBadges, SummaryMetric } from './shared';
import { STATUS_LABELS } from './types';

function SummaryPanel({
	compact = false,
	summary,
}: {
	compact?: boolean;
	summary: ScenarioSummary;
}) {
	return (
		<section className="space-y-3 rounded-md border p-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold">Summary</h2>
				<Badge variant="secondary">Saved totals</Badge>
			</div>
			<div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'md:grid-cols-3')}>
				<SummaryMetric label="Final price" value={formatCurrency(summary.finalPrice)} />
				<SummaryMetric label="Direct cost" value={formatCurrency(summary.directCost)} />
				<SummaryMetric label="Gross profit" value={formatCurrency(summary.grossProfit)} />
				<SummaryMetric label="Margin" value={formatPercent(summary.marginPercent)} />
				<SummaryMetric label="Markup" value={formatPercent(summary.markupPercent)} />
				<SummaryMetric
					label="Target price"
					value={formatCurrency(summary.targetPriceBeforeTax)}
				/>
				<SummaryMetric
					label="Contingency"
					value={formatCurrency(summary.contingencyAmount)}
				/>
				<SummaryMetric label="Discount" value={formatCurrency(summary.discountAmount)} />
				<SummaryMetric label="Tax" value={formatCurrency(summary.taxAmount)} />
			</div>
		</section>
	);
}

export { SummaryPanel };

export function ScenarioSummaryTab() {
	const { summary } = useScenarioForm();

	return <SummaryPanel summary={summary} />;
}

export function ScenarioExportTab() {
	const { copyExport, copyFeedback, exportText, savedDetail } = useScenarioForm();
	const canCopyExport = exportText.length > 0;

	return (
		<section className="space-y-3 rounded-md border p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-lg font-semibold">Markdown summary</h2>
					{savedDetail && (
						<Badge variant="secondary">
							{STATUS_LABELS[savedDetail.scenario.status]}
						</Badge>
					)}
				</div>
				<Button
					disabled={!canCopyExport}
					onClick={() => void copyExport()}
					size="sm"
					type="button"
					variant="outline">
					<Copy aria-hidden="true" className="size-4" />
					Copy
				</Button>
			</div>
			<Textarea
				aria-label="Markdown scenario summary"
				placeholder="No saved scenario selected."
				readOnly
				rows={16}
				value={exportText}
			/>
			{copyFeedback && (
				<p
					className={cn(
						'text-sm',
						copyFeedback.type === 'success'
							? 'text-emerald-700 dark:text-emerald-300'
							: 'text-destructive'
					)}
					role={copyFeedback.type === 'success' ? 'status' : 'alert'}>
					{copyFeedback.message}
				</p>
			)}
		</section>
	);
}

export function ScenarioSidebarSummary() {
	const { summary } = useScenarioForm();

	return (
		<>
			<SummaryPanel compact summary={summary} />
			<section className="space-y-3 rounded-md border p-4">
				<h2 className="text-sm font-semibold">Risk flags</h2>
				<RiskFlagBadges flags={summary.riskFlags} />
			</section>
		</>
	);
}

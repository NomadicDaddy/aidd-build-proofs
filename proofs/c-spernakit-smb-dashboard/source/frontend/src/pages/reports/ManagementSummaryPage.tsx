import { Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { CountBucket, ManagementSummary } from '@/api/reports';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useManagementSummary } from '@/hooks/reports/useReports';

/** A single headline metric tile. */
function StatTile({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardContent className="pt-6">
				<p className="text-muted-foreground text-sm">{label}</p>
				<p className="text-2xl font-semibold tabular-nums">{value}</p>
			</CardContent>
		</Card>
	);
}

/** A labeled breakdown table for one summary dimension. */
function BreakdownCard({ buckets, title }: { buckets: CountBucket[]; title: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{buckets.length === 0 ? (
					<p className="text-muted-foreground text-sm">No data.</p>
				) : (
					<dl className="space-y-1">
						{buckets.map((b) => (
							<div className="flex justify-between text-sm" key={b.key}>
								<dt className="text-muted-foreground">{b.label}</dt>
								<dd className="font-medium tabular-nums">{b.count}</dd>
							</div>
						))}
					</dl>
				)}
			</CardContent>
		</Card>
	);
}

/** The risk-indicator grid drawn from the summary's risk counts. */
function RiskCards({ summary }: { summary: ManagementSummary }) {
	const risks: { label: string; value: number }[] = [
		{ label: 'Unowned assets', value: summary.risks.unownedAssets },
		{ label: 'Unsupported OS', value: summary.risks.unsupportedOs },
		{ label: 'Internet-exposed ports', value: summary.risks.internetExposedPorts },
		{ label: 'Unknown/unexpected ports', value: summary.risks.unknownPorts },
		{ label: 'Critical without backup', value: summary.risks.criticalWithoutBackup },
	];
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{risks.map((r) => (
				<StatTile key={r.label} label={r.label} value={r.value} />
			))}
		</div>
	);
}

/**
 * Printable management summary. Renders the infrastructure overview — total
 * assets, breakdowns by type/status/criticality/site/owner, and risk
 * indicators — in a clean layout suited to `window.print()` (or the browser's
 * "Save as PDF"). Data is read-only and VIEWER-accessible.
 */
function ManagementSummaryPage() {
	const { data: summary, isLoading } = useManagementSummary();

	return (
		<div className="space-y-6">
			<PageHeader
				description="A printable overview of the infrastructure inventory and its risk indicators."
				eyebrow="Reporting"
				title="Management Summary">
				<div className="flex gap-2 print:hidden">
					<Button asChild size="sm" variant="outline">
						<Link to="/reports">Back to reports</Link>
					</Button>
					<Button onClick={() => window.print()} size="sm">
						<Printer aria-hidden="true" className="mr-2 size-4" />
						Print
					</Button>
				</div>
			</PageHeader>

			{isLoading || !summary ? (
				<div className="space-y-4">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			) : (
				<div className="space-y-8">
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<StatTile label="Total assets" value={summary.totalAssets} />
					</div>

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<BreakdownCard buckets={summary.byType} title="By type" />
						<BreakdownCard buckets={summary.byStatus} title="By status" />
						<BreakdownCard buckets={summary.byCriticality} title="By criticality" />
						<BreakdownCard buckets={summary.bySite} title="By site" />
						<BreakdownCard buckets={summary.byOwner} title="By owner" />
					</div>

					<section className="space-y-3">
						<h2 className="text-lg font-semibold">Risk indicators</h2>
						<RiskCards summary={summary} />
					</section>
				</div>
			)}
		</div>
	);
}

export { ManagementSummaryPage };

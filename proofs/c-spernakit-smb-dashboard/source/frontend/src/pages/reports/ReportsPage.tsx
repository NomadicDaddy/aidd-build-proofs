import { Download, FileBarChart, FileJson, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import type { ReportCategory, ReportInfo } from '@/api/reports';

import { downloadReport } from '@/api/reports';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReports } from '@/hooks/reports/useReports';
import { downloadBlob } from '@/lib/download';

/** Human-readable section headings for each report category. */
const CATEGORY_META: Record<ReportCategory, { description: string; title: string }> = {
	audit: {
		description: 'Audit-friendly reports for changes, ownership gaps, exposure, and lifecycle.',
		title: 'Audit reports',
	},
	data: {
		description: 'Raw exports of the inventory, catalog, and management summary.',
		title: 'Data exports',
	},
};

/** A single report card with CSV and JSON download actions. */
function ReportCard({ report }: { report: ReportInfo }) {
	const [busy, setBusy] = useState<'csv' | 'json' | null>(null);

	async function handleDownload(format: 'csv' | 'json') {
		setBusy(format);
		try {
			const blob = await downloadReport(report.key, format);
			downloadBlob(blob, `${report.key}-report.${format}`);
		} catch {
			toast.error(`Could not export ${report.label} as ${format.toUpperCase()}.`);
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{report.label}</CardTitle>
				<CardDescription>{report.description}</CardDescription>
			</CardHeader>
			<CardContent className="flex gap-2">
				<Button
					disabled={busy !== null}
					onClick={() => void handleDownload('csv')}
					size="sm"
					variant="outline">
					<FileSpreadsheet aria-hidden="true" className="mr-2 size-4" />
					{busy === 'csv' ? 'Exporting…' : 'CSV'}
				</Button>
				<Button
					disabled={busy !== null}
					onClick={() => void handleDownload('json')}
					size="sm"
					variant="outline">
					<FileJson aria-hidden="true" className="mr-2 size-4" />
					{busy === 'json' ? 'Exporting…' : 'JSON'}
				</Button>
			</CardContent>
		</Card>
	);
}

/** Render one category section with its report cards. */
function ReportSection({ category, reports }: { category: ReportCategory; reports: ReportInfo[] }) {
	if (reports.length === 0) return null;
	const meta = CATEGORY_META[category];
	return (
		<section className="space-y-3">
			<div>
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					{category === 'audit' ? (
						<ShieldAlert aria-hidden="true" className="size-5" />
					) : (
						<Download aria-hidden="true" className="size-5" />
					)}
					{meta.title}
				</h2>
				<p className="text-muted-foreground text-sm">{meta.description}</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{reports.map((report) => (
					<ReportCard key={report.key} report={report} />
				))}
			</div>
		</section>
	);
}

/**
 * Reports & exports landing page. Lists every available export (assets,
 * relationships, services, ports, management summary) and audit-friendly report
 * (change history, ownership gaps, exposed ports, lifecycle) with one-click CSV
 * and JSON downloads, plus a link to the printable management summary. Every
 * export is permission-filtered server-side by the caller's role.
 */
function ReportsPage() {
	const { data, isLoading } = useReports();
	const reports = data ?? [];
	const dataReports = reports.filter((r) => r.category === 'data');
	const auditReports = reports.filter((r) => r.category === 'audit');

	return (
		<div className="space-y-8">
			<PageHeader
				description="Export inventory data and audit-friendly reports as CSV or JSON, or open the printable management summary."
				eyebrow="Reporting"
				icon={FileBarChart}
				title="Reports & Exports">
				<Button asChild size="sm" variant="outline">
					<Link to="/reports/summary">Management summary</Link>
				</Button>
			</PageHeader>

			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
			) : (
				<>
					<ReportSection category="data" reports={dataReports} />
					<ReportSection category="audit" reports={auditReports} />
				</>
			)}
		</div>
	);
}

export { ReportsPage };

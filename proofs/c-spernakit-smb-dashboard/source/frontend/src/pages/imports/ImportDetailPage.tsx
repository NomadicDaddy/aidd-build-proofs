import { Check, FileWarning, Play, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ImportRow } from '@/api/imports';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useApplyImport, useImportDetail, useReviewImportRow } from '@/hooks/imports/useImports';
import { useAuthorization } from '@/hooks/useAuthorization';

import {
	IMPORT_STATUS_LABELS,
	IMPORT_STATUS_VARIANTS,
	ROW_STATUS_LABELS,
	ROW_STATUS_VARIANTS,
} from './importDisplay';

/** Read a string field from a staged row's parsed data, if present. */
function parsedField(row: ImportRow, key: string): string {
	const value = row.parsedData?.[key];
	return typeof value === 'string' ? value : '';
}

/** Batch lifecycle states that still allow reviewing rows and applying. */
const OPEN_STATUSES = new Set(['pending', 'reviewing']);

/**
 * Import review page. Shows a staged batch's summary and every parsed row with
 * its validation/duplicate message and disposition. OPERATOR+ users accept or
 * reject individual rows, then apply the batch — creating new assets and
 * updating matched duplicates. Rejected and needs-review rows never mutate any
 * record. Once applied, the batch is read-only.
 */
function ImportDetailPage() {
	const params = useParams<{ id: string }>();
	const id = Number(params.id);
	const isValidId = Number.isInteger(id) && id > 0;

	const { data, isLoading } = useImportDetail(id);
	const reviewMutation = useReviewImportRow(id);
	const applyMutation = useApplyImport(id);
	const { isOperator } = useAuthorization();
	const canWrite = isOperator();
	const [confirmApply, setConfirmApply] = useState(false);

	if (!isValidId || (!isLoading && !data)) {
		return (
			<div className="space-y-6">
				<PageHeader
					breadcrumbs={[{ label: 'Imports', to: '/imports' }, { label: 'Not found' }]}
					title="Import not found"
				/>
				<EmptyState
					description="This import batch does not exist or has been removed."
					icon={FileWarning}
					title="Import not found"
				/>
			</div>
		);
	}

	if (isLoading || !data) {
		return (
			<div className="space-y-6">
				<PageHeader
					breadcrumbs={[{ label: 'Imports', to: '/imports' }, { label: 'Loading…' }]}
					title="Import"
				/>
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const { import: batch, rows } = data;
	const isOpen = OPEN_STATUSES.has(batch.status);
	const acceptedPending = rows.filter((r) => r.status === 'accepted').length;

	function review(row: ImportRow, status: 'accepted' | 'rejected') {
		reviewMutation.mutate({ rowId: row.id, status });
	}

	return (
		<div className="space-y-6">
			<PageHeader
				breadcrumbs={[
					{ label: 'Imports', to: '/imports' },
					{ label: batch.source ?? `Import #${batch.id}` },
				]}
				description={
					isOpen
						? 'Accept or reject each row, then apply. Nothing changes the inventory until you apply.'
						: 'This import has been applied and is now read-only.'
				}
				eyebrow="Import & Review"
				title={batch.source ?? `Import #${batch.id}`}>
				{canWrite && isOpen && (
					<Button
						disabled={applyMutation.isPending || acceptedPending === 0}
						onClick={() => setConfirmApply(true)}>
						<Play aria-hidden="true" className="mr-2 size-4" />
						Apply {acceptedPending > 0 ? `(${acceptedPending})` : ''}
					</Button>
				)}
			</PageHeader>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
				<SummaryCard label="Status">
					<Badge variant={IMPORT_STATUS_VARIANTS[batch.status]}>
						{IMPORT_STATUS_LABELS[batch.status]}
					</Badge>
				</SummaryCard>
				<SummaryCard label="Rows">{batch.rowCount}</SummaryCard>
				<SummaryCard label="Accepted">{batch.acceptedCount}</SummaryCard>
				<SummaryCard label="Rejected">{batch.rejectedCount}</SummaryCard>
				<SummaryCard label="Warnings">{batch.warningCount}</SummaryCard>
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">#</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Disposition</TableHead>
							<TableHead>Notes</TableHead>
							{canWrite && isOpen && (
								<TableHead className="text-right">Review</TableHead>
							)}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => {
							const name = parsedField(row, 'name') || '(missing name)';
							const type = parsedField(row, 'assetType') || '—';
							const canAccept = row.status !== 'needs_review';
							return (
								<TableRow key={row.id}>
									<TableCell className="text-muted-foreground tabular-nums">
										{row.rowNumber ?? '—'}
									</TableCell>
									<TableCell className="font-medium">
										{row.targetAssetId ? (
											<Link
												className="hover:underline"
												to={`/assets/${row.targetAssetId}`}>
												{name}
											</Link>
										) : (
											name
										)}
									</TableCell>
									<TableCell className="text-sm">{type}</TableCell>
									<TableCell>
										<Badge variant={ROW_STATUS_VARIANTS[row.status]}>
											{ROW_STATUS_LABELS[row.status]}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground max-w-xs text-xs">
										{row.message ?? ''}
									</TableCell>
									{canWrite && isOpen && (
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<Button
													aria-label="Accept row"
													disabled={
														!canAccept ||
														reviewMutation.isPending ||
														row.status === 'accepted'
													}
													onClick={() => review(row, 'accepted')}
													size="sm"
													variant={
														row.status === 'accepted'
															? 'default'
															: 'outline'
													}>
													<Check aria-hidden="true" className="size-4" />
												</Button>
												<Button
													aria-label="Reject row"
													disabled={
														reviewMutation.isPending ||
														row.status === 'rejected'
													}
													onClick={() => review(row, 'rejected')}
													size="sm"
													variant={
														row.status === 'rejected'
															? 'destructive'
															: 'outline'
													}>
													<X aria-hidden="true" className="size-4" />
												</Button>
											</div>
										</TableCell>
									)}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			<ConfirmAlertDialog
				confirmText="Apply import"
				description={`Create or update assets for the ${acceptedPending} accepted row(s)? Rejected and unreviewed rows will not change any record. This cannot be undone.`}
				isOpen={confirmApply}
				isPending={applyMutation.isPending}
				onConfirm={() => {
					applyMutation.mutate(undefined, { onSuccess: () => setConfirmApply(false) });
				}}
				onOpenChange={setConfirmApply}
				title="Apply import"
			/>
		</div>
	);
}

/** Compact labelled metric tile used in the batch summary row. */
function SummaryCard({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent className="text-2xl font-semibold tabular-nums">{children}</CardContent>
		</Card>
	);
}

export { ImportDetailPage };

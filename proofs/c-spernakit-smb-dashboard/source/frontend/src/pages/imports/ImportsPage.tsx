import { FileSpreadsheet, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { CreateImportInput } from '@/api/imports';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useCreateImport, useImports } from '@/hooks/imports/useImports';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useUrlFilters } from '@/hooks/useUrlFilters';

import { IMPORT_STATUS_LABELS, IMPORT_STATUS_VARIANTS } from './importDisplay';
import { NewImportDialog } from './NewImportDialog';

/** Format an ISO timestamp as a compact local date-time, tolerating bad input. */
function formatDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

/**
 * CSV import review landing page. Lists every staged/applied import batch with
 * its row counts and lifecycle status, and lets OPERATOR+ users stage a new CSV
 * for review. Each batch links to its detail page where individual rows are
 * accepted or rejected and the batch is applied.
 */
function ImportsPage() {
	const { limit, page, setPage } = useUrlFilters(20);
	const [dialogOpen, setDialogOpen] = useState(false);
	const navigate = useNavigate();

	const { isOperator } = useAuthorization();
	const canWrite = isOperator();

	const { data, isLoading } = useImports(page, limit);
	const createMutation = useCreateImport();

	const batches = data?.data ?? [];

	function handleSubmit(input: CreateImportInput) {
		createMutation.mutate(input, {
			onSuccess: (result) => {
				setDialogOpen(false);
				void navigate(`/imports/${result.import.id}`);
			},
		});
	}

	return (
		<div className="space-y-6">
			<PageHeader
				description="Stage CSV data for review, then accept or reject individual rows before anything touches the inventory."
				eyebrow="Import & Review"
				icon={Upload}
				title="Imports">
				{canWrite && (
					<Button onClick={() => setDialogOpen(true)} size="sm">
						<Plus aria-hidden="true" className="mr-2 size-4" />
						New import
					</Button>
				)}
			</PageHeader>

			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-48 w-full" />
				</div>
			) : batches.length === 0 ? (
				<EmptyState
					action={
						canWrite ? (
							<Button onClick={() => setDialogOpen(true)} size="sm">
								<Plus aria-hidden="true" className="mr-2 size-4" />
								New import
							</Button>
						) : undefined
					}
					description="Stage a CSV of assets to review duplicates and validation before applying them to the inventory."
					icon={FileSpreadsheet}
					title="No imports yet"
				/>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Source</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Rows</TableHead>
								<TableHead className="text-right">Accepted</TableHead>
								<TableHead className="text-right">Rejected</TableHead>
								<TableHead className="text-right">Warnings</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{batches.map((batch) => (
								<TableRow key={batch.id}>
									<TableCell className="font-medium">
										<Link
											className="hover:underline"
											to={`/imports/${batch.id}`}>
											{batch.source ?? `Import #${batch.id}`}
										</Link>
									</TableCell>
									<TableCell>
										<Badge variant={IMPORT_STATUS_VARIANTS[batch.status]}>
											{IMPORT_STATUS_LABELS[batch.status]}
										</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{batch.rowCount}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{batch.acceptedCount}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{batch.rejectedCount}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{batch.warningCount}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatDate(batch.createdAt)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			{(data?.total ?? 0) > limit && (
				<div className="flex items-center justify-end gap-2">
					<Button
						disabled={page <= 1}
						onClick={() => setPage(page - 1)}
						size="sm"
						variant="outline">
						Previous
					</Button>
					<span className="text-muted-foreground text-sm">Page {page}</span>
					<Button
						disabled={page * limit >= (data?.total ?? 0)}
						onClick={() => setPage(page + 1)}
						size="sm"
						variant="outline">
						Next
					</Button>
				</div>
			)}

			<NewImportDialog
				isOpen={dialogOpen}
				isPending={createMutation.isPending}
				onOpenChange={setDialogOpen}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}

export { ImportsPage };

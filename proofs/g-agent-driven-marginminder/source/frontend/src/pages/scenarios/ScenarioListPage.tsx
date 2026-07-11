import { useQuery } from '@tanstack/react-query';
import {
	Archive,
	ClipboardList,
	FilePlus2,
	GitCompareArrows,
	Pencil,
	RotateCcw,
	Search,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { ScenarioRiskFlag, ScenarioStatus } from '@/api/types';

import { listScenarios } from '@/api/scenarios';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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

const STATUS_OPTIONS: ('all' | ScenarioStatus)[] = [
	'all',
	'draft',
	'review',
	'approved',
	'archived',
];

const STATUS_LABELS: Record<'all' | ScenarioStatus, string> = {
	all: 'All statuses',
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

function formatDate(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

function RiskFlagsCell({ count, flags }: { count: number; flags: ScenarioRiskFlag[] }) {
	if (count === 0) {
		return <span className="text-muted-foreground">None</span>;
	}

	return (
		<div className="flex flex-wrap justify-end gap-1">
			<Badge variant="secondary">
				{count} {count === 1 ? 'warning' : 'warnings'}
			</Badge>
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

function ScenarioListPage() {
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<'all' | ScenarioStatus>('all');
	const [includeArchived, setIncludeArchived] = useState(false);

	const effectiveIncludeArchived = includeArchived || status === 'archived';
	const hasActiveFilters = search.trim().length > 0 || status !== 'all' || includeArchived;
	const queryKey = ['scenarios', { includeArchived: effectiveIncludeArchived, search, status }];
	const { data, isLoading } = useQuery({
		queryFn: () => {
			const trimmedSearch = search.trim();
			return listScenarios({
				includeArchived: effectiveIncludeArchived,
				...(trimmedSearch ? { search: trimmedSearch } : {}),
				status,
			});
		},
		queryKey,
	});
	const scenarios = data?.data.data ?? [];

	function toggleIncludeArchived() {
		setIncludeArchived((current) => !current);
	}

	function resetFilters() {
		setSearch('');
		setStatus('all');
		setIncludeArchived(false);
	}

	return (
		<div className="space-y-5 p-6">
			<PageHeader
				description="Saved quote scenarios with current pricing summary fields."
				icon={ClipboardList}
				title="Scenarios">
				<Button asChild variant="outline">
					<Link to="/compare">
						<GitCompareArrows aria-hidden="true" className="size-4" />
						Compare
					</Link>
				</Button>
				<Button asChild>
					<Link to="/scenarios/new">
						<FilePlus2 aria-hidden="true" className="size-4" />
						New Scenario
					</Link>
				</Button>
			</PageHeader>

			<div className="flex flex-col gap-3 md:flex-row md:items-center">
				<div className="relative min-w-0 flex-1">
					<Search
						aria-hidden="true"
						className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						aria-label="Search scenarios"
						className="pl-9"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search customer or title"
						value={search}
					/>
				</div>
				<Select
					onValueChange={(value) => setStatus(value as 'all' | ScenarioStatus)}
					value={status}>
					<SelectTrigger aria-label="Filter scenario status" className="w-full md:w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((option) => (
							<SelectItem key={option} value={option}>
								{STATUS_LABELS[option]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<button
					aria-checked={effectiveIncludeArchived}
					className="hover:bg-accent flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					disabled={status === 'archived'}
					onClick={toggleIncludeArchived}
					role="switch"
					type="button">
					<span
						aria-hidden="true"
						className={cn(
							'inline-flex h-3.5 w-6 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors',
							effectiveIncludeArchived ? 'bg-primary' : 'bg-input'
						)}>
						<span
							className={cn(
								'bg-background block size-3 rounded-full transition-transform',
								effectiveIncludeArchived && 'translate-x-2.5'
							)}
						/>
					</span>
					<span>Show archived scenarios</span>
				</button>
			</div>

			<div className="rounded-md border">
				<Table className="min-w-[56rem]">
					<TableHeader>
						<TableRow>
							<TableHead>Scenario</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Final Price</TableHead>
							<TableHead className="text-right">Margin</TableHead>
							<TableHead className="text-right">Target</TableHead>
							<TableHead className="text-right">Risks</TableHead>
							<TableHead>Updated</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{scenarios.map((scenario) => (
							<TableRow key={scenario.id}>
								<TableCell>
									<div className="max-w-[22rem] min-w-0">
										<div className="truncate font-medium">{scenario.title}</div>
										<div className="text-muted-foreground truncate text-xs">
											{scenario.customerName}
										</div>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="secondary">
										{STATUS_LABELS[scenario.status]}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									{formatCurrency(scenario.finalPrice)}
								</TableCell>
								<TableCell className="text-right">
									{formatPercent(scenario.marginPercent, 'Not priced')}
								</TableCell>
								<TableCell className="text-right">
									{formatPercent(scenario.targetMarginPercent)}
								</TableCell>
								<TableCell className="text-right">
									<RiskFlagsCell
										count={scenario.riskCount}
										flags={scenario.riskFlags}
									/>
								</TableCell>
								<TableCell>{formatDate(scenario.updatedAt)}</TableCell>
								<TableCell>
									<Button
										aria-label={`Edit ${scenario.title}`}
										asChild
										size="icon-sm"
										variant="ghost">
										<Link to={`/scenarios/${scenario.id}`}>
											<Pencil aria-hidden="true" className="size-4" />
										</Link>
									</Button>
								</TableCell>
							</TableRow>
						))}
						{scenarios.length === 0 && (
							<TableRow>
								<TableCell className="h-28 text-center" colSpan={8}>
									<div className="text-muted-foreground flex flex-col items-center gap-3 text-sm">
										<Archive aria-hidden="true" className="size-5" />
										<span>
											{hasActiveFilters
												? 'No scenarios match the current filters.'
												: 'No saved scenarios are available yet.'}
										</span>
										{hasActiveFilters && (
											<Button
												onClick={resetFilters}
												size="sm"
												type="button"
												variant="outline">
												<RotateCcw aria-hidden="true" className="size-4" />
												Clear filters
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{isLoading && <div className="text-muted-foreground text-sm">Loading scenarios...</div>}
		</div>
	);
}

export { ScenarioListPage };

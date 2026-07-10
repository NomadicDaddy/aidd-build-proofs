import type { LucideIcon } from 'lucide-react';
import type { AssetType, CriticalityLevel } from 'spernakit-shared';

import { Boxes, Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { AssetSearchResult, ServiceSearchResult } from '@/api/search';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MIN_SEARCH_LENGTH, useGlobalSearch } from '@/hooks/search/useGlobalSearch';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
	assetTypeIcon,
	assetTypeLabel,
	criticalityLabel,
	criticalityVariant,
} from '@/pages/assets/assetDisplay';
import { categoryLabel } from '@/pages/services/serviceDisplay';

/** Delay before a keystroke turns into a search request. */
const DEBOUNCE_MS = 250;

/** Renders the "matched on: …" field labels for a result. */
function MatchedFields({ fields }: { fields: string[] }) {
	if (fields.length === 0) return null;
	return (
		<div className="mt-1 flex flex-wrap items-center gap-1">
			<span className="text-muted-foreground text-xs">matched:</span>
			{fields.map((field) => (
				<Badge className="text-xs font-normal" key={field} variant="outline">
					{field}
				</Badge>
			))}
		</div>
	);
}

/** A single asset hit, linking to the asset detail page. */
function AssetResultCard({ icon: Icon, result }: { icon: LucideIcon; result: AssetSearchResult }) {
	const detail = [result.hostname, result.primaryIp].filter(Boolean).join(' · ');
	return (
		<Card className="hover:bg-accent/50 transition-colors">
			<Link
				aria-label={`Open asset ${result.name}`}
				className="flex items-start gap-3 p-4"
				to={`/assets/${result.id}`}>
				<Icon aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate font-medium">{result.name}</span>
						<Badge variant={criticalityVariant(result.criticality as CriticalityLevel)}>
							{criticalityLabel(result.criticality as CriticalityLevel)}
						</Badge>
					</div>
					<div className="text-muted-foreground text-sm">
						{assetTypeLabel(result.assetType as AssetType)}
						{detail && <span> · {detail}</span>}
					</div>
					<MatchedFields fields={result.matchedFields} />
				</div>
			</Link>
		</Card>
	);
}

/** A single service hit, linking to the service detail page. */
function ServiceResultCard({ result }: { result: ServiceSearchResult }) {
	return (
		<Card className="hover:bg-accent/50 transition-colors">
			<Link
				aria-label={`Open service ${result.name}`}
				className="flex items-start gap-3 p-4"
				to={`/services/${result.id}`}>
				<Boxes
					aria-hidden="true"
					className="text-muted-foreground mt-0.5 size-5 shrink-0"
				/>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate font-medium">{result.name}</span>
						<Badge variant={criticalityVariant(result.criticality as CriticalityLevel)}>
							{criticalityLabel(result.criticality as CriticalityLevel)}
						</Badge>
					</div>
					{result.category && (
						<div className="text-muted-foreground text-sm">
							{categoryLabel(result.category)}
						</div>
					)}
					<MatchedFields fields={result.matchedFields} />
				</div>
			</Link>
		</Card>
	);
}

/** A titled group of result cards with a count. */
function ResultGroup({
	children,
	count,
	title,
}: {
	children: React.ReactNode;
	count: number;
	title: string;
}) {
	if (count === 0) return null;
	return (
		<section className="space-y-2">
			<h2 className="text-muted-foreground text-sm font-semibold tracking-tight">
				{title} <span className="tabular-nums">({count})</span>
			</h2>
			<div className="grid gap-2">{children}</div>
		</section>
	);
}

/**
 * Global search page. Searches across assets and services (and their related
 * records — aliases, tags, IPs, ports, owners) via {@link useGlobalSearch},
 * grouping typed results that link to the relevant detail page. The term is
 * synced to the URL (`?q=`) so searches are shareable and survive reloads.
 */
function GlobalSearchPage() {
	const { getFilter, setFilter } = useUrlFilters();
	const urlTerm = getFilter('q');

	// Local input value for responsive typing; the URL (and thus the query) is
	// updated after a short debounce. Seeded once from the URL so a shared
	// `?q=` link (or a reload) pre-fills the box.
	const [input, setInput] = useState(urlTerm);

	useEffect(() => {
		if (input === urlTerm) return;
		const handle = setTimeout(() => setFilter('q', input), DEBOUNCE_MS);
		return () => clearTimeout(handle);
	}, [input, urlTerm, setFilter]);

	const { enabled, isFetching, results } = useGlobalSearch(urlTerm);
	const hasResults = results && results.totalCount > 0;

	return (
		<div className="space-y-6">
			<PageHeader
				description="Search across assets, hostnames, IP addresses, ports, services, owners, tags, and aliases."
				eyebrow="Search"
				icon={Search}
				title="Global Search"
			/>

			<div className="relative max-w-2xl">
				<Search
					aria-hidden="true"
					className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
				/>
				<Input
					aria-label="Search infrastructure"
					autoFocus
					className="pl-9"
					onChange={(e) => setInput(e.target.value)}
					placeholder="Search assets, services, IPs, ports, owners…"
					value={input}
				/>
			</div>

			{!enabled && (
				<EmptyState
					description={`Type at least ${MIN_SEARCH_LENGTH} characters to search the infrastructure inventory.`}
					icon={Search}
					title="Start typing to search"
				/>
			)}

			{enabled && isFetching && !results && (
				<div className="grid max-w-2xl gap-2">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			)}

			{enabled && results && !hasResults && !isFetching && (
				<EmptyState
					description={`No assets or services matched "${urlTerm}". Try a different term.`}
					icon={SearchX}
					title="No results"
				/>
			)}

			{enabled && hasResults && (
				<div className="max-w-2xl space-y-6">
					<ResultGroup count={results.assets.length} title="Assets">
						{results.assets.map((result) => (
							<AssetResultCard
								icon={assetTypeIcon(result.assetType as AssetType)}
								key={result.id}
								result={result}
							/>
						))}
					</ResultGroup>
					<ResultGroup count={results.services.length} title="Services">
						{results.services.map((result) => (
							<ServiceResultCard key={result.id} result={result} />
						))}
					</ResultGroup>
				</div>
			)}
		</div>
	);
}

export { GlobalSearchPage };

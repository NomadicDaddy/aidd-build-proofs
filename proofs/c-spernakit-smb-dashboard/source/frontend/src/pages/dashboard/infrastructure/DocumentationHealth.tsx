import type { LucideIcon } from 'lucide-react';
import type { DocumentationHealthSignal } from 'spernakit-shared';

import { CalendarClock, ScrollText, ShieldQuestion, Tags, UserX, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { DocumentationHealthSummary } from '@/api/documentationHealth';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentationHealthAssets } from '@/hooks/dashboards/useDocumentationHealth';
import { cn } from '@/lib/utils';
import { assetTypeLabel, assetStatusLabel } from '@/pages/assets/assetDisplay';

interface SignalMeta {
	description: string;
	icon: LucideIcon;
	key: DocumentationHealthSignal;
	label: string;
}

/** Display order, labels, and icons for the six documentation-health signals. */
const SIGNALS: SignalMeta[] = [
	{
		description: 'Never verified or overdue for review',
		icon: CalendarClock,
		key: 'stale',
		label: 'Stale documentation',
	},
	{
		description: 'No business or technical owner recorded',
		icon: UserX,
		key: 'missingOwner',
		label: 'Missing owner',
	},
	{
		description: 'No documented backup destination',
		icon: ShieldQuestion,
		key: 'missingBackup',
		label: 'Missing backup status',
	},
	{
		description: 'Not linked in any relationship',
		icon: Waypoints,
		key: 'missingRelationshipMap',
		label: 'Missing relationship map',
	},
	{
		description: 'No documented role or assigned service',
		icon: Tags,
		key: 'missingServiceRole',
		label: 'Missing service role',
	},
	{
		description: 'Ports never verified or needing review',
		icon: ScrollText,
		key: 'unverifiedPorts',
		label: 'Unverified port data',
	},
];

/** The drill-in list of assets flagged by the currently selected signal. */
function SignalAssetList({
	signal,
	thresholdDays,
}: {
	signal: DocumentationHealthSignal;
	thresholdDays: number;
}) {
	const { assets, isError, isLoading, total } = useDocumentationHealthAssets(
		signal,
		thresholdDays
	);
	const meta = SIGNALS.find((s) => s.key === signal);

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton className="h-10 w-full" key={i} />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="text-destructive text-sm">
				Could not load the flagged assets. Try again.
			</p>
		);
	}

	if (assets.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No assets are flagged as “{meta?.label.toLowerCase()}”. Nothing to document here.
			</p>
		);
	}

	return (
		<div className="space-y-2">
			<p className="text-muted-foreground text-xs">
				Showing {assets.length} of {total.toLocaleString()} flagged asset
				{total === 1 ? '' : 's'}.
			</p>
			<ul className="divide-border divide-y rounded-md border">
				{assets.map((asset) => (
					<li key={asset.id}>
						<Link
							className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3 py-2 transition-colors"
							to={`/assets/${asset.id}`}>
							<div className="min-w-0">
								<div className="truncate text-sm font-medium">{asset.name}</div>
								<div className="text-muted-foreground truncate text-xs">
									{assetTypeLabel(asset.assetType)}
									{asset.primaryIp ? ` · ${asset.primaryIp}` : ''}
								</div>
							</div>
							<Badge variant="outline">{assetStatusLabel(asset.status)}</Badge>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * Documentation-health card: the six completeness-gap signals as selectable
 * tiles, each drilling into the filterable list of the assets it flags.
 */
function DocumentationHealthCard({
	health,
	isLoading,
}: {
	health: DocumentationHealthSummary | undefined;
	isLoading: boolean;
}) {
	const [selected, setSelected] = useState<DocumentationHealthSignal | null>(null);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Documentation Health</CardTitle>
				<CardDescription>
					{health
						? `Completeness gaps across ${health.totalAssets.toLocaleString()} assets · stale threshold ${health.thresholdDays} days.`
						: 'Completeness gaps across the live inventory.'}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{SIGNALS.map(({ description, icon: Icon, key, label }) => {
						const value = health?.signals[key] ?? 0;
						const flagged = value > 0;
						const active = selected === key;
						return (
							<button
								aria-pressed={active}
								className={cn(
									'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
									active ? 'border-primary bg-muted/60' : 'hover:bg-muted/40',
									!flagged && !active && 'opacity-70'
								)}
								disabled={isLoading}
								key={key}
								onClick={() => setSelected(active ? null : key)}
								type="button">
								<Icon
									aria-hidden="true"
									className={cn(
										'mt-0.5 size-4 shrink-0',
										flagged
											? 'text-amber-600 dark:text-amber-500'
											: 'text-muted-foreground'
									)}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<span className="text-sm font-medium">{label}</span>
										<span
											className={cn(
												'text-sm font-semibold tabular-nums',
												flagged && 'text-amber-600 dark:text-amber-500'
											)}>
											{isLoading ? '—' : value.toLocaleString()}
										</span>
									</div>
									<p className="text-muted-foreground text-xs">{description}</p>
								</div>
							</button>
						);
					})}
				</div>
				{selected && health && (
					<div className="border-t pt-4">
						<SignalAssetList signal={selected} thresholdDays={health.thresholdDays} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export { DocumentationHealthCard };

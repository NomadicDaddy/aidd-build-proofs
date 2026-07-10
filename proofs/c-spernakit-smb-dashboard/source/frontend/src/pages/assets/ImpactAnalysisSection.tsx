import type { LucideIcon } from 'lucide-react';

import { ArrowDownRight, ArrowUpRight, Link2, ServerCog, ShieldAlert, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { type ImpactNode } from '@/api/impact';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssetImpact } from '@/hooks/relationships/useAssetImpact';

import { relationshipTypeLabel } from '../relationships/relationshipDisplay';
import {
	assetTypeIcon,
	assetTypeLabel,
	criticalityLabel,
	criticalityVariant,
} from './assetDisplay';

/** One summary stat tile in the impact overview row. */
function StatTile({
	icon: Icon,
	label,
	value,
}: {
	icon: LucideIcon;
	label: string;
	value: number;
}) {
	return (
		<div className="rounded-lg border p-4">
			<div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
				<Icon aria-hidden="true" className="size-3.5" />
				{label}
			</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
		</div>
	);
}

/** One impacted/depended-on asset rendered as a linked row with its edge context. */
function ImpactRow({ icon: Icon, node }: { icon: LucideIcon; node: ImpactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
			<div className="flex min-w-0 items-center gap-2">
				<Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
				<Link
					className="text-primary truncate text-sm font-medium hover:underline"
					to={`/assets/${node.id}`}>
					{node.name}
				</Link>
				<span className="text-muted-foreground text-xs">
					{assetTypeLabel(node.assetType)}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<Badge variant="outline">{relationshipTypeLabel(node.relationshipType)}</Badge>
				<Badge variant={criticalityVariant(node.criticality)}>
					{criticalityLabel(node.criticality)}
				</Badge>
				<Badge variant="secondary">
					{node.depth === 1 ? 'Direct' : `${node.depth} hops`}
				</Badge>
			</div>
		</div>
	);
}

/** A titled list of impact nodes, or a muted note when the list is empty. */
function ImpactList({
	description,
	emptyText,
	icon: Icon,
	nodes,
	title,
}: {
	description: string;
	emptyText: string;
	icon: LucideIcon;
	nodes: ImpactNode[];
	title: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Icon aria-hidden="true" className="text-muted-foreground size-4" />
					{title}
					<Badge variant="secondary">{nodes.length}</Badge>
				</CardTitle>
				<p className="text-muted-foreground text-sm">{description}</p>
			</CardHeader>
			<CardContent>
				{nodes.length === 0 ? (
					<p className="text-muted-foreground text-sm">{emptyText}</p>
				) : (
					<div className="space-y-2">
						{nodes.map((node) => (
							<ImpactRow
								icon={assetTypeIcon(node.assetType)}
								key={`${node.id}-${node.depth}`}
								node={node}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Impact-analysis subsection of the asset detail Relationships tab. Answers "what
 * breaks if this asset goes offline?" by traversing the dependency graph: the
 * assets impacted downstream, the business services among them, and the upstream
 * assets this one depends on. Degrades to a clear empty state when the asset has
 * no recorded dependencies.
 */
export function ImpactAnalysisSection({ assetId, enabled }: { assetId: number; enabled: boolean }) {
	const { data, isError, isLoading } = useAssetImpact(assetId, enabled);
	const analysis = data?.data;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}

	if (isError || !analysis) {
		return (
			<EmptyState
				description="The dependency impact for this asset could not be computed. Try again shortly."
				icon={Link2}
				title="Couldn't load impact analysis"
				variant="compact"
			/>
		);
	}

	const { affectedServices, downstream, summary, upstream } = analysis;

	if (downstream.length === 0 && upstream.length === 0) {
		return (
			<EmptyState
				description="This asset has no recorded dependency relationships, so there is no upstream or downstream impact to analyze yet. Add relationships to map what this asset depends on and what depends on it."
				icon={Link2}
				title="No dependencies to analyze"
				variant="compact"
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile icon={Zap} label="Breaks if offline" value={summary.downstreamCount} />
				<StatTile
					icon={ShieldAlert}
					label="Services affected"
					value={summary.affectedServiceCount}
				/>
				<StatTile icon={ServerCog} label="Depends on" value={summary.upstreamCount} />
				<StatTile
					icon={ArrowDownRight}
					label="Max impact depth"
					value={summary.maxDownstreamDepth}
				/>
			</div>

			{affectedServices.length > 0 && (
				<ImpactList
					description="Business services that would be degraded or unavailable if this asset went offline."
					emptyText="No business services are affected."
					icon={ShieldAlert}
					nodes={affectedServices}
					title="Business services affected"
				/>
			)}

			<ImpactList
				description="Assets that would be impacted if this asset went offline, following runs-on, hosting, storage, and dependency edges."
				emptyText="Nothing depends on this asset."
				icon={ArrowDownRight}
				nodes={downstream}
				title="What breaks if this asset is offline"
			/>

			<ImpactList
				description="Assets this one depends on — their outage would in turn impact this asset."
				emptyText="This asset does not depend on anything recorded."
				icon={ArrowUpRight}
				nodes={upstream}
				title="What this asset depends on"
			/>
		</div>
	);
}

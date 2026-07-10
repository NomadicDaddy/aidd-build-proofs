import { History } from 'lucide-react';
import { useState } from 'react';
import { CHANGE_EVENT_ACTIONS } from 'spernakit-shared';

import type { AssetChangeEvent } from '@/api/assets';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssetHistory } from '@/hooks/assets/useAssetHistory';

/** Badge variant per change action so create/delete read at a glance. */
const ACTION_VARIANT: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
	archive: 'outline',
	create: 'default',
	delete: 'destructive',
	import: 'secondary',
	restore: 'secondary',
	update: 'outline',
};

/** Human label for the entity a change event describes. */
function entityLabel(entityType: string): string {
	if (entityType === 'asset') return 'Asset';
	if (entityType === 'asset_relationship') return 'Relationship';
	return entityType
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/** Format an ISO timestamp as an absolute, locale-aware date-time. */
function formatTimestamp(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(undefined, {
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

/** A single change event rendered as a timeline row. */
function HistoryRow({ event }: { event: AssetChangeEvent }) {
	const actor =
		event.actorUsername ?? (event.actorId === null ? 'System' : `User #${event.actorId}`);
	return (
		<li className="border-border flex flex-col gap-1 border-b py-3 last:border-b-0">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={ACTION_VARIANT[event.action] ?? 'outline'}>{event.action}</Badge>
				<span className="text-muted-foreground text-xs">
					{entityLabel(event.entityType)}
				</span>
				<span className="text-muted-foreground ml-auto text-xs">
					{formatTimestamp(event.createdAt)}
				</span>
			</div>
			{event.summary && <p className="text-sm">{event.summary}</p>}
			<p className="text-muted-foreground text-xs">by {actor}</p>
		</li>
	);
}

/**
 * The History tab of the asset detail page: the change-event audit trail for a
 * single asset (create / update / delete / restore / archive / import), newest
 * first, with an action filter. Backed by `GET /assets/:id/history`.
 */
export function AssetHistorySection({ assetId, enabled }: { assetId: number; enabled: boolean }) {
	const [action, setAction] = useState('');
	const { data, isError, isLoading } = useAssetHistory(assetId, action, enabled);
	const events = data?.data ?? [];

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Select
					onValueChange={(value) => setAction(value === 'all' ? '' : value)}
					value={action || 'all'}>
					<SelectTrigger aria-label="Filter history by action" className="w-[180px]">
						<SelectValue placeholder="All actions" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All actions</SelectItem>
						{CHANGE_EVENT_ACTIONS.map((value) => (
							<SelectItem key={value} value={value}>
								{value.charAt(0).toUpperCase() + value.slice(1)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : isError ? (
				<EmptyState
					description="The change history could not be loaded. Refresh the page to try again."
					icon={History}
					title="Unable to load history"
					variant="compact"
				/>
			) : events.length === 0 ? (
				<EmptyState
					description={
						action
							? 'No change events match the selected action for this asset.'
							: 'No change events have been recorded for this asset yet.'
					}
					icon={History}
					title="No change history yet"
					variant="compact"
				/>
			) : (
				<ul className="rounded-md border px-4">
					{events.map((event) => (
						<HistoryRow event={event} key={event.id} />
					))}
				</ul>
			)}
		</div>
	);
}

import type { CountBucket } from '@/api/infrastructureSummary';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BreakdownListProps {
	buckets: CountBucket[];
	/** Optional prettifier for enum-style bucket labels (type/status/criticality). */
	formatLabel?: (key: string, label: string) => string;
	title: string;
}

/**
 * A single "counts by dimension" card: each bucket renders as a labelled row
 * with its count and a proportional bar. Rows are sorted by count descending so
 * the largest groups lead. Renders a compact empty state when there is no data.
 */
function BreakdownList({ buckets, formatLabel, title }: BreakdownListProps) {
	const sorted = [...buckets].sort((a, b) => b.count - a.count);
	const max = sorted.reduce((m, b) => Math.max(m, b.count), 0);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{sorted.length === 0 ? (
					<p className="text-muted-foreground text-sm">No data yet.</p>
				) : (
					<ul className="space-y-2.5">
						{sorted.map((bucket) => (
							<li key={bucket.key}>
								<div className="mb-1 flex items-baseline justify-between gap-2">
									<span className="truncate text-sm">
										{formatLabel
											? formatLabel(bucket.key, bucket.label)
											: bucket.label}
									</span>
									<span className="text-sm font-semibold tabular-nums">
										{bucket.count.toLocaleString()}
									</span>
								</div>
								<div className="bg-muted h-1.5 overflow-hidden rounded-full">
									<div
										className={cn('bg-primary/70 h-full rounded-full')}
										style={{
											width: `${max > 0 ? (bucket.count / max) * 100 : 0}%`,
										}}
									/>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

export { BreakdownList };

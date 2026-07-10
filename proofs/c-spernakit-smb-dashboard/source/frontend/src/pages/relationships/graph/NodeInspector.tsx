import { ArrowRight, Crosshair, ExternalLink, X, Zap } from 'lucide-react';
import { createElement } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { assetTypeIcon, assetTypeLabel } from '@/pages/assets/assetDisplay';

import type { Graph, GraphNode } from './graphTypes';

import { relationshipTypeLabel } from '../relationshipDisplay';

interface NodeInspectorProps {
	graph: Graph;
	node: GraphNode;
	onClose: () => void;
	onFocus: (id: number) => void;
}

/** One incident edge described from the selected node's point of view. */
interface Incident {
	direction: 'in' | 'out';
	key: number;
	other: GraphNode | undefined;
	relationshipType: string;
}

/**
 * Detail panel for the selected map node. Summarises the asset, lists its direct
 * relationships with direction, and exposes the map's node-level entry points:
 * focus the map on this asset's dependency tree, jump to its impact analysis, or
 * open the full asset record.
 */
function NodeInspector({ graph, node, onClose, onFocus }: NodeInspectorProps) {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));

	const incidents: Incident[] = graph.edges
		.filter((edge) => edge.source === node.id || edge.target === node.id)
		.map((edge) => {
			const isOut = edge.source === node.id;
			return {
				direction: isOut ? 'out' : 'in',
				key: edge.id,
				other: byId.get(isOut ? edge.target : edge.source),
				relationshipType: relationshipTypeLabel(edge.relationshipType),
			};
		});

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					{createElement(assetTypeIcon(node.assetType ?? 'other'), {
						'aria-hidden': true,
						className: 'text-muted-foreground size-5 shrink-0',
					})}
					<div className="min-w-0">
						<p className="truncate font-semibold">{node.name}</p>
						<p className="text-muted-foreground text-xs">
							{assetTypeLabel(node.assetType ?? 'other')}
						</p>
					</div>
				</div>
				<Button aria-label="Close details" onClick={onClose} size="icon-sm" variant="ghost">
					<X />
				</Button>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button onClick={() => onFocus(node.id)} size="sm" variant="secondary">
					<Crosshair /> Focus map
				</Button>
				<Button asChild size="sm" variant="secondary">
					<Link to={`/assets/${node.id}?tab=relationships`}>
						<Zap /> Impact
					</Link>
				</Button>
				<Button asChild size="sm" variant="outline">
					<Link to={`/assets/${node.id}`}>
						<ExternalLink /> Open asset
					</Link>
				</Button>
			</div>

			<div>
				<p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
					Relationships ({incidents.length})
				</p>
				<div className="space-y-2">
					{incidents.map((incident) => (
						<div className="rounded-lg border p-2.5 text-sm" key={incident.key}>
							<div className="flex items-center gap-1.5">
								<Badge variant="outline">{incident.relationshipType}</Badge>
								<ArrowRight
									aria-hidden="true"
									className={`text-muted-foreground size-3.5 ${
										incident.direction === 'in' ? 'rotate-180' : ''
									}`}
								/>
							</div>
							{incident.other ? (
								<Link
									className="text-primary mt-1 block truncate hover:underline"
									to={`/assets/${incident.other.id}`}>
									{incident.other.name}
								</Link>
							) : (
								<span className="text-muted-foreground mt-1 block">
									Unknown asset
								</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export { NodeInspector };

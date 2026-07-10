import { Network, TableProperties, Waypoints } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOwners } from '@/hooks/owners/useOwners';
import { useRelationshipGraph } from '@/hooks/relationships/useRelationshipGraph';
import { useUrlFilters } from '@/hooks/useUrlFilters';

import { computeLayout } from './graph/graphLayout';
import { buildGraph, filterGraphByAssetType, subgraphAround } from './graph/graphTypes';
import { NodeInspector } from './graph/NodeInspector';
import { TopologyCanvas } from './graph/TopologyCanvas';
import { TopologyMapFilters } from './graph/TopologyMapFilters';

/** Link back to the accessible table equivalent — the map's fallback view. */
function TableViewLink() {
	return (
		<Button asChild size="sm" variant="outline">
			<Link to="/relationships">
				<TableProperties /> Table view
			</Link>
		</Button>
	);
}

/**
 * Interactive dependency and topology map. Renders the relationship graph as a
 * pannable, zoomable force-directed diagram with asset-type-styled nodes and
 * relationship-typed directional edges. The graph can be scoped to a single
 * asset's dependency tree (with one-hop / multi-hop expansion) and filtered by
 * relationship type, asset type, criticality, status, confidence, and owner.
 * Selecting a node opens an inspector with impact-analysis and asset entry
 * points. Always keeps the accessible {@link /relationships} table reachable.
 */
function RelationshipMapPage() {
	const { getFilter, setFilter, setFilters } = useUrlFilters();
	const [selectedId, setSelectedId] = useState<null | number>(null);

	const { data, isError, isLoading } = useRelationshipGraph({
		confidence: getFilter('confidence'),
		criticality: getFilter('criticality'),
		owner: getFilter('owner'),
		relationshipType: getFilter('type'),
		search: getFilter('search'),
		status: getFilter('status'),
	});
	// The owner list only populates an optional filter dropdown, so a failure here
	// degrades to "no owner filter" rather than crashing the whole map.
	const { data: ownersData } = useOwners({ throwOnError: false });

	const relationships = useMemo(() => data?.data ?? [], [data]);
	const total = data?.total ?? 0;
	const fullGraph = useMemo(() => buildGraph(relationships), [relationships]);

	const scope = getFilter('scope');
	const focusRaw = getFilter('focus');
	const focusId = scope === 'focus' && focusRaw ? Number(focusRaw) : null;
	const depth = Number(getFilter('depth')) || 2;
	const assetType = getFilter('assetType');

	const displayedGraph = useMemo(() => {
		const scoped = focusId !== null ? subgraphAround(fullGraph, focusId, depth) : fullGraph;
		return filterGraphByAssetType(scoped, assetType);
	}, [assetType, depth, focusId, fullGraph]);

	const layout = useMemo(() => computeLayout(displayedGraph), [displayedGraph]);

	const focusName = useMemo(
		() => fullGraph.nodes.find((node) => node.id === focusId)?.name ?? null,
		[focusId, fullGraph.nodes]
	);
	const selectedNode = useMemo(
		() => displayedGraph.nodes.find((node) => node.id === selectedId) ?? null,
		[displayedGraph.nodes, selectedId]
	);

	const handleFocus = (id: number): void => {
		setFilters((params) => {
			params.set('scope', 'focus');
			params.set('focus', String(id));
			params.set('depth', '1');
		});
		setSelectedId(id);
	};

	const handleClearFocus = (): void => {
		setFilters((params) => {
			params.delete('scope');
			params.delete('focus');
			params.delete('depth');
		});
	};

	return (
		<div className="space-y-6">
			<PageHeader
				description="An interactive map of how your infrastructure fits together. Drag to pan, scroll to zoom, and click a node to inspect its dependencies and impact."
				eyebrow="Topology"
				icon={Waypoints}
				title="Dependency map">
				<TableViewLink />
			</PageHeader>

			<TopologyMapFilters
				focusName={focusName}
				getFilter={getFilter}
				onClearFocus={handleClearFocus}
				owners={ownersData?.data ?? []}
				setFilter={setFilter}
			/>

			{total > relationships.length && (
				<p className="text-muted-foreground text-sm">
					Showing the first {relationships.length} of {total} relationships. Narrow the
					filters or scope to a single asset to see a focused view.
				</p>
			)}

			{isLoading ? (
				<Skeleton className="h-[640px] w-full rounded-lg" />
			) : isError ? (
				<EmptyState
					description="The relationship graph could not be loaded. Try again shortly, or use the table view."
					icon={Network}
					title="Couldn't load the map"
				/>
			) : displayedGraph.nodes.length === 0 ? (
				<EmptyState
					action={<TableViewLink />}
					description={
						focusId !== null
							? 'This asset has no relationships within the current filters. Clear the focus or adjust the filters to see more of the graph.'
							: 'No relationships match the current filters yet. Record relationships between assets to see them mapped here.'
					}
					icon={Network}
					title="Nothing to map"
				/>
			) : (
				<div className="bg-card flex h-[640px] overflow-hidden rounded-lg border">
					<div className="min-w-0 flex-1">
						<TopologyCanvas
							focusId={focusId}
							graph={displayedGraph}
							layout={layout}
							onSelect={setSelectedId}
							selectedId={selectedId}
						/>
					</div>
					{selectedNode && (
						<div className="w-80 shrink-0 border-l">
							<NodeInspector
								graph={displayedGraph}
								node={selectedNode}
								onClose={() => setSelectedId(null)}
								onFocus={handleFocus}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export { RelationshipMapPage };

import { Network, Waypoints } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DataTable } from '@/components/shared/data-table/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelationships } from '@/hooks/relationships/useRelationships';
import { useUrlFilters } from '@/hooks/useUrlFilters';

import { RelationshipTableFilters } from './RelationshipTableFilters';
import { useRelationshipColumns } from './useRelationshipColumns';

/**
 * Accessible table/list view of asset relationships — the structured, keyboard-
 * and screen-reader-friendly equivalent of the relationship graph. Every edge
 * the graph can draw appears here as a row (source → target, type, confidence,
 * notes). Consumes the paginated, server-side filtered relationship API through
 * {@link useRelationships}; the endpoint search plus relationship-type,
 * confidence, status, and criticality filters are synced to the URL so views
 * are shareable and survive reloads.
 */
function RelationshipsPage() {
	const { getFilter, limit, page, setFilter, setLimit, setPage } = useUrlFilters(20);
	const search = getFilter('search');
	const relationshipType = getFilter('type');
	const confidence = getFilter('confidence');
	const status = getFilter('status');
	const criticality = getFilter('criticality');

	const { data, isLoading } = useRelationships(page, limit, {
		confidence,
		criticality,
		relationshipType,
		search,
		status,
	});

	const columns = useRelationshipColumns();

	const relationships = data?.data ?? [];
	const total = data?.total ?? 0;

	return (
		<div className="space-y-6">
			<PageHeader
				description="A structured, accessible list of every relationship between assets — the table equivalent of the dependency graph."
				eyebrow="Topology"
				icon={Waypoints}
				title="Relationships">
				<Button asChild size="sm" variant="outline">
					<Link to="/relationships/map">
						<Network /> Map view
					</Link>
				</Button>
			</PageHeader>

			<RelationshipTableFilters
				confidence={confidence}
				criticality={criticality}
				onConfidenceChange={(value) => setFilter('confidence', value)}
				onCriticalityChange={(value) => setFilter('criticality', value)}
				onRelationshipTypeChange={(value) => setFilter('type', value)}
				onSearchChange={(value) => setFilter('search', value)}
				onStatusChange={(value) => setFilter('status', value)}
				relationshipType={relationshipType}
				search={search}
				status={status}
			/>

			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			) : (
				<DataTable
					columns={columns}
					data={relationships}
					pagination={{
						limit,
						onPageChange: setPage,
						onPageSizeChange: setLimit,
						page,
						total,
					}}
				/>
			)}
		</div>
	);
}

export { RelationshipsPage };

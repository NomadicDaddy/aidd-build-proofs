import { useQuery } from '@tanstack/react-query';

import { listRelationships } from '@/api/relationships';

/** Server-side filters shared by the relationship table and topology map. */
interface RelationshipGraphFilters {
	confidence: string;
	criticality: string;
	owner: string;
	relationshipType: string;
	search: string;
	status: string;
}

/** The largest single page the relationships endpoint will return. */
const GRAPH_PAGE_LIMIT = 100;

/**
 * Fetch the relationship edges that back the topology map. The map derives its
 * nodes from edge endpoints, so a single wide page (capped at the API's
 * `MAX_PAGE_LIMIT`) is requested with the same server-side filters the table
 * uses. `total` is surfaced so the page can warn when the graph is truncated.
 */
export function useRelationshipGraph(filters: RelationshipGraphFilters) {
	const params: Record<string, string> = {
		limit: String(GRAPH_PAGE_LIMIT),
		page: '1',
	};
	if (filters.search) params.search = filters.search;
	if (filters.relationshipType) params.relationshipType = filters.relationshipType;
	if (filters.confidence) params.confidence = filters.confidence;
	if (filters.status) params.status = filters.status;
	if (filters.criticality) params.criticality = filters.criticality;
	if (filters.owner) params.ownerId = filters.owner;

	const { data, isError, isLoading } = useQuery({
		queryFn: () => listRelationships(params),
		queryKey: [
			'relationship-graph',
			filters.search,
			filters.relationshipType,
			filters.confidence,
			filters.status,
			filters.criticality,
			filters.owner,
		],
	});

	return { data, isError, isLoading };
}

import { useQuery } from '@tanstack/react-query';

import { listRelationships } from '@/api/relationships';

/** URL-filter values that drive the relationship list query. Empty strings are omitted. */
interface RelationshipListFilters {
	confidence: string;
	criticality: string;
	relationshipType: string;
	search: string;
	status: string;
}

/**
 * Data for the relationship table/list view. Wraps the paginated, server-side
 * filtered relationship list query so the accessible table stays in sync with
 * the same edges the graph renders.
 */
export function useRelationships(page: number, limit: number, filters: RelationshipListFilters) {
	const queryParams: Record<string, string> = { limit: String(limit), page: String(page) };
	if (filters.search) queryParams.search = filters.search;
	if (filters.relationshipType) queryParams.relationshipType = filters.relationshipType;
	if (filters.confidence) queryParams.confidence = filters.confidence;
	if (filters.status) queryParams.status = filters.status;
	if (filters.criticality) queryParams.criticality = filters.criticality;

	const { data, isLoading } = useQuery({
		queryFn: () => listRelationships(queryParams),
		queryKey: [
			'relationships',
			page,
			limit,
			filters.search,
			filters.relationshipType,
			filters.confidence,
			filters.status,
			filters.criticality,
		],
	});

	return { data, isLoading };
}

export type { RelationshipListFilters };

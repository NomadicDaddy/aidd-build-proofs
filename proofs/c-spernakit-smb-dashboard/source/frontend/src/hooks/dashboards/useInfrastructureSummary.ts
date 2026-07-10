import { useQuery } from '@tanstack/react-query';

import { getInfrastructureSummary } from '@/api/infrastructureSummary';

/**
 * Query hook for the operational dashboard summary. Fetches the aggregate
 * infrastructure figures (`GET /infrastructure/summary`) that the dashboard
 * cards render. Enabled only for authenticated users with dashboard access.
 */
export function useInfrastructureSummary(enabled = true) {
	const { data, isError, isLoading } = useQuery({
		enabled,
		queryFn: async () => {
			const res = await getInfrastructureSummary();
			return res.data;
		},
		queryKey: ['infrastructure-summary'],
		staleTime: 30_000,
		throwOnError: false,
	});

	return { isError, isLoading, summary: data };
}

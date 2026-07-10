import { useQuery } from '@tanstack/react-query';

import { getManagementSummary, listReports } from '@/api/reports';

/** The catalog of available reports and exports. */
function useReports() {
	return useQuery({
		queryFn: () => listReports(),
		queryKey: ['reports', 'catalog'],
	});
}

/** The management summary payload for the printable overview. */
function useManagementSummary() {
	return useQuery({
		queryFn: () => getManagementSummary(),
		queryKey: ['reports', 'summary'],
	});
}

export { useManagementSummary, useReports };

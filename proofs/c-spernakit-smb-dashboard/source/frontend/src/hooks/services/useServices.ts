import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateServiceInput, UpdateServiceInput } from '@/api/services';

import { createService, deleteService, listServices, updateService } from '@/api/services';
import { stdCallbacks } from '@/lib/mutationHelpers';

/** URL-filter values that drive the service catalog query. Empty strings are omitted. */
interface ServiceListFilters {
	category: string;
	criticality: string;
	search: string;
}

/**
 * Data + mutations for the service catalog page.
 *
 * Wraps the paginated, server-side filtered service list query and the create /
 * update / soft-delete mutations, invalidating the `services` query key on every
 * successful write so the table refreshes.
 */
export function useServices(page: number, limit: number, filters: ServiceListFilters) {
	const queryClient = useQueryClient();

	const queryParams: Record<string, string> = { limit: String(limit), page: String(page) };
	if (filters.search) queryParams.search = filters.search;
	if (filters.category) queryParams.category = filters.category;
	if (filters.criticality) queryParams.criticality = filters.criticality;

	const { data, isLoading } = useQuery({
		queryFn: () => listServices(queryParams),
		queryKey: ['services', page, limit, filters.search, filters.category, filters.criticality],
	});

	const cb = (success: string, error: string) =>
		stdCallbacks(queryClient, {
			errorMessage: error,
			invalidateKeys: [['services']],
			successMessage: success,
		});

	const createMutation = useMutation({
		mutationFn: (input: CreateServiceInput) => createService(input),
		...cb('Service created', 'Failed to create service. Check the input fields and try again.'),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: UpdateServiceInput }) =>
			updateService(id, input),
		...cb('Service updated', 'Failed to update service. Review the changes and try again.'),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteService(id),
		...cb('Service deleted', 'Failed to delete service. Refresh the list and try again.'),
	});

	return { createMutation, data, deleteMutation, isLoading, updateMutation };
}

export type { ServiceListFilters };

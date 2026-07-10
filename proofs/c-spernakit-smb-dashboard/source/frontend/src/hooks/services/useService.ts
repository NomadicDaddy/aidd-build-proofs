import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DependencyInput, UpdateServiceInput } from '@/api/services';

import {
	addServiceDependency,
	getService,
	removeServiceDependency,
	updateService,
} from '@/api/services';
import { stdCallbacks } from '@/lib/mutationHelpers';

/**
 * Data + mutations for a single service's detail page. Wraps the detail query
 * (service, backing assets, dependencies) and the update / add-dependency /
 * remove-dependency mutations, invalidating the detail and the list on every
 * successful write.
 */
export function useService(id: number) {
	const queryClient = useQueryClient();

	const { data, isError, isLoading } = useQuery({
		enabled: Number.isFinite(id) && id > 0,
		queryFn: () => getService(id),
		queryKey: ['service', id],
	});

	const cb = (success: string, error: string) =>
		stdCallbacks(queryClient, {
			errorMessage: error,
			invalidateKeys: [['service', id], ['services']],
			successMessage: success,
		});

	const updateMutation = useMutation({
		mutationFn: (input: UpdateServiceInput) => updateService(id, input),
		...cb('Service updated', 'Failed to update service. Review the changes and try again.'),
	});

	const addDependencyMutation = useMutation({
		mutationFn: (input: DependencyInput) => addServiceDependency(id, input),
		...cb('Dependency added', 'Failed to add dependency. Check the target and try again.'),
	});

	const removeDependencyMutation = useMutation({
		mutationFn: (dependencyId: number) => removeServiceDependency(id, dependencyId),
		...cb('Dependency removed', 'Failed to remove dependency. Refresh and try again.'),
	});

	return {
		addDependencyMutation,
		data,
		isError,
		isLoading,
		removeDependencyMutation,
		updateMutation,
	};
}

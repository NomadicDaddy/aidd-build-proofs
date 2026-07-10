import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { InfrastructureSettingsInput } from '@/api/infrastructureSettings';

import {
	getInfrastructureSettings,
	updateInfrastructureSettings,
} from '@/api/infrastructureSettings';

const INFRA_SETTINGS_KEY = ['settings', 'infrastructure'];

/** Read the infrastructure domain settings. Available to VIEWER+ callers. */
export function useInfrastructureSettings() {
	return useQuery({
		queryFn: getInfrastructureSettings,
		queryKey: INFRA_SETTINGS_KEY,
		staleTime: 60_000,
	});
}

/** Persist a partial update to the infrastructure domain settings (ADMIN+). */
export function useUpdateInfrastructureSettings() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: InfrastructureSettingsInput) => updateInfrastructureSettings(input),
		onSuccess: (data) => {
			queryClient.setQueryData(INFRA_SETTINGS_KEY, data);
			// Stale-threshold changes alter the documentation-health signals.
			void queryClient.invalidateQueries({ queryKey: ['documentation-health'] });
		},
	});
}

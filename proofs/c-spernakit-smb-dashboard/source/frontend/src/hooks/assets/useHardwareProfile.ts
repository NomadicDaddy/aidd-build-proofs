import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { HardwareProfile, HardwareProfileInput } from '@/api/assets';
import type { DataResponse } from '@/api/types';

import { getHardwareProfile, updateHardwareProfile } from '@/api/assets';

/** Query key for a single asset's hardware profile. */
function hardwareProfileKey(assetId: number): (number | string)[] {
	return ['asset-hardware-profile', assetId];
}

/**
 * Fetch an asset's hardware profile. Enabled only for a valid asset id so the
 * query does not fire while the detail page is still resolving its route param.
 *
 * @param assetId - Asset id whose profile to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useHardwareProfile(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<HardwareProfile | null>, Error>({
		enabled,
		queryFn: () => getHardwareProfile(assetId),
		queryKey: hardwareProfileKey(assetId),
	});
}

/**
 * Upsert an asset's hardware profile, refreshing the cached profile on success.
 *
 * @param assetId - Asset id whose profile to persist
 */
export function useUpdateHardwareProfile(assetId: number) {
	const queryClient = useQueryClient();
	return useMutation<DataResponse<HardwareProfile>, Error, HardwareProfileInput>({
		mutationFn: (input) => updateHardwareProfile(assetId, input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: hardwareProfileKey(assetId) });
			// The profile write also appends to the asset change-event trail.
			await queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
		},
	});
}

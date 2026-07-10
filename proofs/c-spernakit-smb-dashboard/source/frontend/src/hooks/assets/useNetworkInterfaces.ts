import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NetworkInterface, NetworkInterfaceInput } from '@/api/assets';
import type { DataResponse } from '@/api/types';

import {
	createNetworkInterface,
	deleteNetworkInterface,
	getNetworkInterfaces,
	updateNetworkInterface,
} from '@/api/assets';

/** Query key for an asset's network interfaces. */
function networkInterfacesKey(assetId: number): (number | string)[] {
	return ['asset-network-interfaces', assetId];
}

/**
 * Fetch an asset's network interfaces. Enabled only for a valid asset id so the
 * query does not fire while the detail page is still resolving its route param.
 *
 * @param assetId - Asset id whose interfaces to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useNetworkInterfaces(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<NetworkInterface[]>, Error>({
		enabled,
		queryFn: () => getNetworkInterfaces(assetId),
		queryKey: networkInterfacesKey(assetId),
	});
}

/** Invalidate the interface list and the asset change-event trail after a write. */
function useInvalidateAfterWrite(assetId: number) {
	const queryClient = useQueryClient();
	return async () => {
		await queryClient.invalidateQueries({ queryKey: networkInterfacesKey(assetId) });
		// Interface writes also append to the asset change-event trail.
		await queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
	};
}

/**
 * Add a network interface to an asset, refreshing the cached list on success.
 *
 * @param assetId - Asset id the interface belongs to
 */
export function useCreateNetworkInterface(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<NetworkInterface>, Error, NetworkInterfaceInput>({
		mutationFn: (input) => createNetworkInterface(assetId, input),
		onSuccess: invalidate,
	});
}

/**
 * Update one of an asset's network interfaces, refreshing the cache on success.
 *
 * @param assetId - Asset id the interface belongs to
 */
export function useUpdateNetworkInterface(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<
		DataResponse<NetworkInterface>,
		Error,
		{ input: NetworkInterfaceInput; interfaceId: number }
	>({
		mutationFn: ({ input, interfaceId }) => updateNetworkInterface(assetId, interfaceId, input),
		onSuccess: invalidate,
	});
}

/**
 * Delete one of an asset's network interfaces, refreshing the cache on success.
 *
 * @param assetId - Asset id the interface belongs to
 */
export function useDeleteNetworkInterface(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<NetworkInterface>, Error, number>({
		mutationFn: (interfaceId) => deleteNetworkInterface(assetId, interfaceId),
		onSuccess: invalidate,
	});
}

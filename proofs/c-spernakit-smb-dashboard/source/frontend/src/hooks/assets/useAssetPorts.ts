import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AssetPort, PortInput } from '@/api/assets';
import type { DataResponse } from '@/api/types';

import { createAssetPort, deleteAssetPort, getAssetPorts, updateAssetPort } from '@/api/assets';

/** Query key for an asset's ports. */
function assetPortsKey(assetId: number): (number | string)[] {
	return ['asset-ports', assetId];
}

/**
 * Fetch an asset's ports. Enabled only for a valid asset id so the query does
 * not fire while the detail page is still resolving its route param.
 *
 * @param assetId - Asset id whose ports to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useAssetPorts(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<AssetPort[]>, Error>({
		enabled,
		queryFn: () => getAssetPorts(assetId),
		queryKey: assetPortsKey(assetId),
	});
}

/** Invalidate the port list and the asset change-event trail after a write. */
function useInvalidateAfterWrite(assetId: number) {
	const queryClient = useQueryClient();
	return async () => {
		await queryClient.invalidateQueries({ queryKey: assetPortsKey(assetId) });
		// Port writes also append to the asset change-event trail.
		await queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
	};
}

/**
 * Document a port on an asset, refreshing the cached list on success.
 *
 * @param assetId - Asset id the port belongs to
 */
export function useCreateAssetPort(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<AssetPort>, Error, PortInput>({
		mutationFn: (input) => createAssetPort(assetId, input),
		onSuccess: invalidate,
	});
}

/**
 * Update one of an asset's ports, refreshing the cache on success.
 *
 * @param assetId - Asset id the port belongs to
 */
export function useUpdateAssetPort(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<AssetPort>, Error, { input: PortInput; portId: number }>({
		mutationFn: ({ input, portId }) => updateAssetPort(assetId, portId, input),
		onSuccess: invalidate,
	});
}

/**
 * Delete one of an asset's ports, refreshing the cache on success.
 *
 * @param assetId - Asset id the port belongs to
 */
export function useDeleteAssetPort(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<AssetPort>, Error, number>({
		mutationFn: (portId) => deleteAssetPort(assetId, portId),
		onSuccess: invalidate,
	});
}

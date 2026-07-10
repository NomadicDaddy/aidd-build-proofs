import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { StorageAllocation, StorageAllocationInput, StorageConsumer } from '@/api/assets';
import type { DataResponse } from '@/api/types';

import {
	createStorageAllocation,
	deleteStorageAllocation,
	getStorageAllocations,
	getStorageConsumers,
	updateStorageAllocation,
} from '@/api/assets';

/** Query key for an asset's storage allocations. */
function storageAllocationsKey(assetId: number): (number | string)[] {
	return ['asset-storage-allocations', assetId];
}

/** Query key for the assets drawing storage from an asset acting as a pool. */
function storageConsumersKey(assetId: number): (number | string)[] {
	return ['asset-storage-consumers', assetId];
}

/**
 * Fetch an asset's storage allocations. Enabled only for a valid asset id so the
 * query does not fire while the detail page is still resolving its route param.
 *
 * @param assetId - Asset id whose allocations to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useStorageAllocations(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<StorageAllocation[]>, Error>({
		enabled,
		queryFn: () => getStorageAllocations(assetId),
		queryKey: storageAllocationsKey(assetId),
	});
}

/**
 * Fetch the allocations that draw storage from this asset acting as a pool. The
 * query degrades gracefully (`throwOnError: false`) so a failure leaves the
 * consumers panel empty rather than crashing the detail page.
 *
 * @param assetId - Storage-pool asset id whose consumers to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useStorageConsumers(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<StorageConsumer[]>, Error>({
		enabled,
		queryFn: () => getStorageConsumers(assetId),
		queryKey: storageConsumersKey(assetId),
		throwOnError: false,
	});
}

/** Invalidate the allocation list, consumers, and the asset change-event trail. */
function useInvalidateAfterWrite(assetId: number) {
	const queryClient = useQueryClient();
	return async () => {
		await queryClient.invalidateQueries({ queryKey: storageAllocationsKey(assetId) });
		// A pool reference means another asset's consumers view may have changed too.
		await queryClient.invalidateQueries({ queryKey: ['asset-storage-consumers'] });
		// Allocation writes also append to the asset change-event trail.
		await queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
	};
}

/**
 * Add a storage allocation to an asset, refreshing the cached list on success.
 *
 * @param assetId - Asset id the allocation belongs to
 */
export function useCreateStorageAllocation(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<StorageAllocation>, Error, StorageAllocationInput>({
		mutationFn: (input) => createStorageAllocation(assetId, input),
		onSuccess: invalidate,
	});
}

/**
 * Update one of an asset's storage allocations, refreshing the cache on success.
 *
 * @param assetId - Asset id the allocation belongs to
 */
export function useUpdateStorageAllocation(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<
		DataResponse<StorageAllocation>,
		Error,
		{ allocationId: number; input: StorageAllocationInput }
	>({
		mutationFn: ({ allocationId, input }) =>
			updateStorageAllocation(assetId, allocationId, input),
		onSuccess: invalidate,
	});
}

/**
 * Delete one of an asset's storage allocations, refreshing the cache on success.
 *
 * @param assetId - Asset id the allocation belongs to
 */
export function useDeleteStorageAllocation(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<StorageAllocation>, Error, number>({
		mutationFn: (allocationId) => deleteStorageAllocation(assetId, allocationId),
		onSuccess: invalidate,
	});
}

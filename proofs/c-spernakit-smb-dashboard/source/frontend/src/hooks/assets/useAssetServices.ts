import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
	AssetServiceAssignment,
	AssignedService,
	CreateAssignmentInput,
	UpdateAssignmentInput,
} from '@/api/assets';
import type { DataResponse } from '@/api/types';

import {
	createAssetService,
	deleteAssetService,
	getAssetServices,
	updateAssetService,
} from '@/api/assets';

/** Query key for an asset's service assignments. */
function assetServicesKey(assetId: number): (number | string)[] {
	return ['asset-services', assetId];
}

/**
 * Fetch the services assigned to an asset. Enabled only for a valid asset id so
 * the query does not fire while the detail page is still resolving its route
 * param.
 *
 * @param assetId - Asset id whose service assignments to load
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useAssetServices(assetId: number, enabled: boolean) {
	return useQuery<DataResponse<AssignedService[]>, Error>({
		enabled,
		queryFn: () => getAssetServices(assetId),
		queryKey: assetServicesKey(assetId),
	});
}

/**
 * Invalidate the assignment list, the asset change-event trail, and the asset
 * detail query (its cached backing-asset count) after a write.
 */
function useInvalidateAfterWrite(assetId: number) {
	const queryClient = useQueryClient();
	return async () => {
		await queryClient.invalidateQueries({ queryKey: assetServicesKey(assetId) });
		// Assignment writes also append to the asset change-event trail and change
		// the backing-asset counts surfaced elsewhere (service catalog / detail).
		await queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
		await queryClient.invalidateQueries({ queryKey: ['services'] });
	};
}

/**
 * Assign a service to an asset, refreshing the cached list on success.
 *
 * @param assetId - Asset id the service is assigned to
 */
export function useCreateAssetService(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<AssetServiceAssignment>, Error, CreateAssignmentInput>({
		mutationFn: (input) => createAssetService(assetId, input),
		onSuccess: invalidate,
	});
}

/**
 * Update an asset's service assignment, refreshing the cache on success.
 *
 * @param assetId - Asset id the assignment belongs to
 */
export function useUpdateAssetService(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<
		DataResponse<AssetServiceAssignment>,
		Error,
		{ assignmentId: number; input: UpdateAssignmentInput }
	>({
		mutationFn: ({ assignmentId, input }) => updateAssetService(assetId, assignmentId, input),
		onSuccess: invalidate,
	});
}

/**
 * Remove a service assignment from an asset, refreshing the cache on success.
 *
 * @param assetId - Asset id the assignment belongs to
 */
export function useDeleteAssetService(assetId: number) {
	const invalidate = useInvalidateAfterWrite(assetId);
	return useMutation<DataResponse<AssetServiceAssignment>, Error, number>({
		mutationFn: (assignmentId) => deleteAssetService(assetId, assignmentId),
		onSuccess: invalidate,
	});
}

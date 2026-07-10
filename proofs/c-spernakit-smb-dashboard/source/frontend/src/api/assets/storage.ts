import type { DataResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A storage allocation attached to an asset, as returned by
 * `GET /assets/:id/storage-allocations`. Mirrors the backend
 * `asset_storage_allocations` row; capacity figures are nullable integers (GB)
 * and `storagePoolAssetId` references the asset acting as the pool/appliance.
 */
interface StorageAllocation {
	assetId: number;
	capacityGb: null | number;
	createdAt: string;
	createdBy: null | number;
	id: number;
	mountPoint: null | string;
	name: null | string;
	notes: null | string;
	storagePoolAssetId: null | number;
	storageType: null | string;
	updatedAt: string;
	updatedBy: null | number;
	usedGb: null | number;
}

/**
 * A storage allocation drawing from an asset acting as a pool, joined to the
 * consuming asset's name, as returned by `GET /assets/:id/storage-consumers`.
 */
interface StorageConsumer extends StorageAllocation {
	consumerAssetName: null | string;
}

/** Writable storage-allocation fields (all optional; `null` clears a column). */
interface StorageAllocationInput {
	capacityGb?: null | number;
	mountPoint?: null | string;
	name?: null | string;
	notes?: null | string;
	storagePoolAssetId?: null | number;
	storageType?: null | string;
	usedGb?: null | number;
}

/** List an asset's storage allocations (largest capacity first). Requires VIEWER+. */
function getStorageAllocations(id: number): Promise<DataResponse<StorageAllocation[]>> {
	return apiClient.get<DataResponse<StorageAllocation[]>>(`/assets/${id}/storage-allocations`);
}

/** List the allocations drawing storage from this asset as a pool. Requires VIEWER+. */
function getStorageConsumers(id: number): Promise<DataResponse<StorageConsumer[]>> {
	return apiClient.get<DataResponse<StorageConsumer[]>>(`/assets/${id}/storage-consumers`);
}

/** Add a storage allocation to an asset. Requires OPERATOR role or higher. */
function createStorageAllocation(
	id: number,
	input: StorageAllocationInput
): Promise<DataResponse<StorageAllocation>> {
	return apiClient.post<DataResponse<StorageAllocation>>(`/assets/${id}/storage-allocations`, {
		body: input,
	});
}

/** Update one of an asset's storage allocations. Requires OPERATOR role or higher. */
function updateStorageAllocation(
	id: number,
	allocationId: number,
	input: StorageAllocationInput
): Promise<DataResponse<StorageAllocation>> {
	return apiClient.patch<DataResponse<StorageAllocation>>(
		`/assets/${id}/storage-allocations/${allocationId}`,
		{ body: input }
	);
}

/** Delete one of an asset's storage allocations. Requires OPERATOR role or higher. */
function deleteStorageAllocation(
	id: number,
	allocationId: number
): Promise<DataResponse<StorageAllocation>> {
	return apiClient.delete<DataResponse<StorageAllocation>>(
		`/assets/${id}/storage-allocations/${allocationId}`
	);
}

export {
	createStorageAllocation,
	deleteStorageAllocation,
	getStorageAllocations,
	getStorageConsumers,
	updateStorageAllocation,
};
export type { StorageAllocation, StorageAllocationInput, StorageConsumer };

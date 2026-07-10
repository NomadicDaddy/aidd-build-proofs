export {
	createStorageAllocation,
	deleteStorageAllocation,
	getStorageAllocation,
	listStorageAllocations,
	listStorageConsumers,
	updateStorageAllocation,
} from './assetStorageAllocationService/operations.ts';
export type {
	StorageAllocationResult,
	StorageAllocationRow,
	StorageAllocationWritableFields,
	StorageConsumer,
} from './assetStorageAllocationService/shared.ts';

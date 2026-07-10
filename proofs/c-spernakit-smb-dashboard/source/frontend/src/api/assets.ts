/**
 * Barrel for the asset inventory API. The implementation is split by
 * sub-resource under `./assets/`; this module re-exports every symbol so
 * existing `@/api/assets` import sites keep working unchanged.
 */

export { createAsset, deleteAsset, getAsset, listAssets, updateAsset } from './assets/asset.ts';
export type {
	Asset,
	AssetWritableFields,
	CreateAssetInput,
	UpdateAssetInput,
} from './assets/asset.ts';

export { getHardwareProfile, updateHardwareProfile } from './assets/hardware.ts';
export type { HardwareProfile, HardwareProfileInput } from './assets/hardware.ts';

export { getAssetHistory } from './assets/history.ts';
export type { AssetChangeEvent } from './assets/history.ts';

export {
	createNetworkInterface,
	deleteNetworkInterface,
	getNetworkInterfaces,
	updateNetworkInterface,
} from './assets/networkInterfaces.ts';
export type { NetworkInterface, NetworkInterfaceInput } from './assets/networkInterfaces.ts';

export {
	createAssetPort,
	deleteAssetPort,
	getAssetPorts,
	updateAssetPort,
} from './assets/ports.ts';
export type { AssetPort, PortInput } from './assets/ports.ts';

export {
	createAssetService,
	deleteAssetService,
	getAssetServices,
	updateAssetService,
} from './assets/serviceAssignments.ts';
export type {
	AssetServiceAssignment,
	AssignedService,
	CreateAssignmentInput,
	UpdateAssignmentInput,
} from './assets/serviceAssignments.ts';

export {
	createStorageAllocation,
	deleteStorageAllocation,
	getStorageAllocations,
	getStorageConsumers,
	updateStorageAllocation,
} from './assets/storage.ts';
export type {
	StorageAllocation,
	StorageAllocationInput,
	StorageConsumer,
} from './assets/storage.ts';

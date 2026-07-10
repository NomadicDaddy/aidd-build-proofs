import type {
	PortExposureLevel,
	PortProtocol,
	PortReviewState,
	PortSource,
} from 'spernakit-shared';

import type { DataResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A documented or observed open port on an asset, as returned by
 * `GET /assets/:id/ports`. Mirrors the backend `asset_ports` row: the enum
 * columns are typed, `serviceId` optionally attributes the port to a catalog
 * service, and `verifiedAt` is an ISO-8601 string when the port was last checked.
 */
interface AssetPort {
	assetId: number;
	createdAt: string;
	createdBy: null | number;
	exposureLevel: PortExposureLevel;
	id: number;
	notes: null | string;
	portNumber: number;
	protocol: PortProtocol;
	reviewState: PortReviewState;
	scope: null | string;
	serviceId: null | number;
	serviceName: null | string;
	source: PortSource;
	updatedAt: string;
	updatedBy: null | number;
	verifiedAt: null | string;
}

/**
 * Writable port fields. `portNumber` is required when creating; every other
 * field is optional. `null` clears a nullable column while `undefined` leaves it
 * untouched. Mirrors the backend `portWritableFields` TypeBox schema.
 */
interface PortInput {
	exposureLevel?: PortExposureLevel;
	notes?: null | string;
	portNumber?: number;
	protocol?: PortProtocol;
	reviewState?: PortReviewState;
	scope?: null | string;
	serviceId?: null | number;
	serviceName?: null | string;
	source?: PortSource;
	verifiedAt?: null | string;
}

/** List an asset's ports (by port number, then protocol). Requires VIEWER+. */
function getAssetPorts(id: number): Promise<DataResponse<AssetPort[]>> {
	return apiClient.get<DataResponse<AssetPort[]>>(`/assets/${id}/ports`);
}

/** Document an open port on an asset. Requires OPERATOR role or higher. */
function createAssetPort(id: number, input: PortInput): Promise<DataResponse<AssetPort>> {
	return apiClient.post<DataResponse<AssetPort>>(`/assets/${id}/ports`, { body: input });
}

/** Update one of an asset's ports. Requires OPERATOR role or higher. */
function updateAssetPort(
	id: number,
	portId: number,
	input: PortInput
): Promise<DataResponse<AssetPort>> {
	return apiClient.patch<DataResponse<AssetPort>>(`/assets/${id}/ports/${portId}`, {
		body: input,
	});
}

/** Delete one of an asset's ports. Requires OPERATOR role or higher. */
function deleteAssetPort(id: number, portId: number): Promise<DataResponse<AssetPort>> {
	return apiClient.delete<DataResponse<AssetPort>>(`/assets/${id}/ports/${portId}`);
}

export { createAssetPort, deleteAssetPort, getAssetPorts, updateAssetPort };
export type { AssetPort, PortInput };

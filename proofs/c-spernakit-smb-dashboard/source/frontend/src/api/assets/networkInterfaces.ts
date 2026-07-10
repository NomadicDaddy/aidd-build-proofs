import type { DataResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A network interface / addressing record attached to an asset, as returned by
 * `GET /assets/:id/network-interfaces`. Mirrors the backend
 * `asset_network_interfaces` row; addressing fields are nullable and `vlanId`
 * is a number when set.
 */
interface NetworkInterface {
	assetId: number;
	createdAt: string;
	createdBy: null | number;
	dnsName: null | string;
	gateway: null | string;
	id: number;
	ipAddress: null | string;
	isPrimary: boolean;
	macAddress: null | string;
	name: null | string;
	networkZoneId: null | number;
	notes: null | string;
	subnetMask: null | string;
	updatedAt: string;
	updatedBy: null | number;
	vlanId: null | number;
}

/** Writable network-interface fields (all optional; `null` clears a column). */
interface NetworkInterfaceInput {
	dnsName?: null | string;
	gateway?: null | string;
	ipAddress?: null | string;
	isPrimary?: boolean;
	macAddress?: null | string;
	name?: null | string;
	networkZoneId?: null | number;
	notes?: null | string;
	subnetMask?: null | string;
	vlanId?: null | number;
}

/** List an asset's network interfaces (primary first). Requires VIEWER+. */
function getNetworkInterfaces(id: number): Promise<DataResponse<NetworkInterface[]>> {
	return apiClient.get<DataResponse<NetworkInterface[]>>(`/assets/${id}/network-interfaces`);
}

/** Add a network interface to an asset. Requires OPERATOR role or higher. */
function createNetworkInterface(
	id: number,
	input: NetworkInterfaceInput
): Promise<DataResponse<NetworkInterface>> {
	return apiClient.post<DataResponse<NetworkInterface>>(`/assets/${id}/network-interfaces`, {
		body: input,
	});
}

/** Update one of an asset's network interfaces. Requires OPERATOR role or higher. */
function updateNetworkInterface(
	id: number,
	interfaceId: number,
	input: NetworkInterfaceInput
): Promise<DataResponse<NetworkInterface>> {
	return apiClient.patch<DataResponse<NetworkInterface>>(
		`/assets/${id}/network-interfaces/${interfaceId}`,
		{ body: input }
	);
}

/** Delete one of an asset's network interfaces. Requires OPERATOR role or higher. */
function deleteNetworkInterface(
	id: number,
	interfaceId: number
): Promise<DataResponse<NetworkInterface>> {
	return apiClient.delete<DataResponse<NetworkInterface>>(
		`/assets/${id}/network-interfaces/${interfaceId}`
	);
}

export {
	createNetworkInterface,
	deleteNetworkInterface,
	getNetworkInterfaces,
	updateNetworkInterface,
};
export type { NetworkInterface, NetworkInterfaceInput };

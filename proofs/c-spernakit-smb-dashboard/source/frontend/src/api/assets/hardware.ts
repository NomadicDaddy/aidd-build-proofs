import type { DataResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * An asset's one-to-one hardware profile as returned by
 * `GET /assets/:id/hardware-profile`. Mirrors the backend
 * `asset_hardware_profiles` row; every fact is nullable and integer counts are
 * numbers. The endpoint returns `null` when the asset has no profile yet.
 */
interface HardwareProfile {
	assetId: number;
	chassisModel: null | string;
	clusterName: null | string;
	cpuCores: null | number;
	cpuModel: null | string;
	cpuSockets: null | number;
	cpuThreads: null | number;
	createdAt: string;
	createdBy: null | number;
	formFactor: null | string;
	guestOs: null | string;
	hardwareModel: null | string;
	hostRole: null | string;
	hypervisor: null | string;
	id: number;
	notes: null | string;
	ramMb: null | number;
	snapshotNotes: null | string;
	totalStorageGb: null | number;
	updatedAt: string;
	updatedBy: null | number;
	vcpuCount: null | number;
	vmToolsStatus: null | string;
}

/** Writable hardware-profile fields (all optional; `null` clears a column). */
interface HardwareProfileInput {
	chassisModel?: null | string;
	clusterName?: null | string;
	cpuCores?: null | number;
	cpuModel?: null | string;
	cpuSockets?: null | number;
	cpuThreads?: null | number;
	formFactor?: null | string;
	guestOs?: null | string;
	hardwareModel?: null | string;
	hostRole?: null | string;
	hypervisor?: null | string;
	notes?: null | string;
	ramMb?: null | number;
	snapshotNotes?: null | string;
	totalStorageGb?: null | number;
	vcpuCount?: null | number;
	vmToolsStatus?: null | string;
}

/** Fetch an asset's hardware profile (or null when none exists). Requires VIEWER+. */
function getHardwareProfile(id: number): Promise<DataResponse<HardwareProfile | null>> {
	return apiClient.get<DataResponse<HardwareProfile | null>>(`/assets/${id}/hardware-profile`);
}

/** Create or update an asset's hardware profile. Requires OPERATOR role or higher. */
function updateHardwareProfile(
	id: number,
	input: HardwareProfileInput
): Promise<DataResponse<HardwareProfile>> {
	return apiClient.put<DataResponse<HardwareProfile>>(`/assets/${id}/hardware-profile`, {
		body: input,
	});
}

export { getHardwareProfile, updateHardwareProfile };
export type { HardwareProfile, HardwareProfileInput };

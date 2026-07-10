import type { CriticalityLevel } from 'spernakit-shared';

import type { DataResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A catalog service assigned to an asset, as returned by
 * `GET /assets/:id/services`. Mirrors the backend `asset_services` row with the
 * service resolved to its name, category, and criticality.
 */
interface AssignedService {
	assignmentId: number;
	isPrimary: boolean;
	notes: null | string;
	role: null | string;
	serviceCategory: null | string;
	serviceCriticality: CriticalityLevel | null;
	serviceId: number;
	serviceName: string;
}

/**
 * The raw `asset_services` row returned by the assignment write endpoints
 * (create / update / delete). The read endpoint returns the enriched
 * {@link AssignedService} instead; callers refetch the list after a write, so
 * this row is not rendered directly.
 */
interface AssetServiceAssignment {
	assetId: number;
	id: number;
	isPrimary: boolean;
	notes: null | string;
	role: null | string;
	serviceId: number;
}

/** Body for assigning a service to an asset. The target service id is required. */
interface CreateAssignmentInput {
	isPrimary?: boolean;
	notes?: null | string;
	role?: null | string;
	serviceId: number;
}

/** Body for updating a service assignment (the target service cannot change). */
interface UpdateAssignmentInput {
	isPrimary?: boolean;
	notes?: null | string;
	role?: null | string;
}

/** List the services assigned to an asset (primary first). Requires VIEWER+. */
function getAssetServices(id: number): Promise<DataResponse<AssignedService[]>> {
	return apiClient.get<DataResponse<AssignedService[]>>(`/assets/${id}/services`);
}

/** Assign a catalog service to an asset. Requires OPERATOR role or higher. */
function createAssetService(
	id: number,
	input: CreateAssignmentInput
): Promise<DataResponse<AssetServiceAssignment>> {
	return apiClient.post<DataResponse<AssetServiceAssignment>>(`/assets/${id}/services`, {
		body: input,
	});
}

/** Update an asset's service assignment (role, primary, notes). Requires OPERATOR+. */
function updateAssetService(
	id: number,
	assignmentId: number,
	input: UpdateAssignmentInput
): Promise<DataResponse<AssetServiceAssignment>> {
	return apiClient.patch<DataResponse<AssetServiceAssignment>>(
		`/assets/${id}/services/${assignmentId}`,
		{ body: input }
	);
}

/** Remove a service assignment from an asset. Requires OPERATOR role or higher. */
function deleteAssetService(
	id: number,
	assignmentId: number
): Promise<DataResponse<AssetServiceAssignment>> {
	return apiClient.delete<DataResponse<AssetServiceAssignment>>(
		`/assets/${id}/services/${assignmentId}`
	);
}

export { createAssetService, deleteAssetService, getAssetServices, updateAssetService };
export type {
	AssetServiceAssignment,
	AssignedService,
	CreateAssignmentInput,
	UpdateAssignmentInput,
};

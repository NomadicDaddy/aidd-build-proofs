import type { AssetType, CriticalityLevel } from 'spernakit-shared';

import type { DataResponse, PaginatedResponse } from './types';

import { apiClient } from './client';

/**
 * A catalog service as returned by the list API, with its owner/vendor resolved
 * to a display name and a count of the assets that back it. Mirrors the backend
 * `service_catalog` row plus the enrichment fields.
 */
interface Service {
	backingAssetCount: number;
	category: null | string;
	createdAt: string;
	criticality: CriticalityLevel;
	description: null | string;
	expectedAvailability: null | string;
	id: number;
	isDeleted: boolean;
	name: string;
	notes: null | string;
	ownerId: null | number;
	ownerName: null | string;
	updatedAt: string;
	vendorId: null | number;
	vendorName: null | string;
}

/** One asset that backs a service, as returned on the service detail payload. */
interface BackingAsset {
	assetId: number;
	assetType: AssetType | null;
	assignmentId: number;
	criticality: CriticalityLevel | null;
	isPrimary: boolean;
	name: null | string;
	role: null | string;
}

/** A service dependency edge with its target resolved to a display name. */
interface ServiceDependency {
	createdAt: string;
	dependencyType: null | string;
	dependsOnAssetId: null | number;
	dependsOnAssetName: null | string;
	dependsOnAssetType: AssetType | null;
	dependsOnServiceId: null | number;
	dependsOnServiceName: null | string;
	id: number;
	notes: null | string;
	serviceId: number;
}

/** A service with its backing assets and dependencies, as returned by `GET /services/:id`. */
interface ServiceDetail extends Service {
	backingAssets: BackingAsset[];
	dependencies: ServiceDependency[];
}

/** Writable service fields shared by create and update (`null` clears a column). */
interface ServiceWritableFields {
	category?: null | string;
	criticality?: CriticalityLevel;
	description?: null | string;
	expectedAvailability?: null | string;
	notes?: null | string;
	ownerId?: null | number;
	vendorId?: null | number;
}

/** Body for creating a service. Name is required. */
interface CreateServiceInput extends ServiceWritableFields {
	name: string;
}

/** Body for updating a service. All fields optional (partial update). */
type UpdateServiceInput = ServiceWritableFields & { name?: string };

/** Body for adding a service dependency — exactly one target id must be set. */
interface DependencyInput {
	dependencyType?: null | string;
	dependsOnAssetId?: null | number;
	dependsOnServiceId?: null | number;
	notes?: null | string;
}

/** Fetch a paginated, filterable list of services. Requires VIEWER role or higher. */
function listServices(params?: Record<string, string>): Promise<PaginatedResponse<Service>> {
	return apiClient.get<PaginatedResponse<Service>>('/services', params ? { params } : undefined);
}

/** Fetch a single service with its backing assets and dependencies. Requires VIEWER+. */
function getService(id: number): Promise<DataResponse<ServiceDetail>> {
	return apiClient.get<DataResponse<ServiceDetail>>(`/services/${id}`);
}

/** Create a new service. Requires OPERATOR role or higher. */
function createService(input: CreateServiceInput): Promise<DataResponse<Service>> {
	return apiClient.post<DataResponse<Service>>('/services', { body: input });
}

/** Update an existing service with a partial patch. Requires OPERATOR role or higher. */
function updateService(id: number, input: UpdateServiceInput): Promise<DataResponse<Service>> {
	return apiClient.patch<DataResponse<Service>>(`/services/${id}`, { body: input });
}

/** Soft-delete a service (recoverable via the API). Requires OPERATOR role or higher. */
function deleteService(id: number): Promise<DataResponse<Service>> {
	return apiClient.delete<DataResponse<Service>>(`/services/${id}`);
}

/** Add a dependency to a service. Requires OPERATOR role or higher. */
function addServiceDependency(
	id: number,
	input: DependencyInput
): Promise<DataResponse<ServiceDependency>> {
	return apiClient.post<DataResponse<ServiceDependency>>(`/services/${id}/dependencies`, {
		body: input,
	});
}

/** Remove a dependency from a service. Requires OPERATOR role or higher. */
function removeServiceDependency(
	id: number,
	dependencyId: number
): Promise<DataResponse<ServiceDependency>> {
	return apiClient.delete<DataResponse<ServiceDependency>>(
		`/services/${id}/dependencies/${dependencyId}`
	);
}

export {
	addServiceDependency,
	createService,
	deleteService,
	getService,
	listServices,
	removeServiceDependency,
	updateService,
};
export type {
	BackingAsset,
	CreateServiceInput,
	DependencyInput,
	Service,
	ServiceDependency,
	ServiceDetail,
	UpdateServiceInput,
};

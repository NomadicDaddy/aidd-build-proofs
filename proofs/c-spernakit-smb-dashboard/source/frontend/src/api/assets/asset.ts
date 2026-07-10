import type { AssetStatus, AssetType, CriticalityLevel } from 'spernakit-shared';

import type { DataResponse, PaginatedResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A single infrastructure asset as returned by the inventory API.
 *
 * Mirrors the backend `assets` row: reference columns (site, owner, vendor,
 * zone, parent host) are exposed as numeric ids, and timestamp columns are
 * serialized to ISO-8601 strings over JSON.
 */
interface Asset {
	assetTag: null | string;
	assetType: AssetType;
	businessOwnerId: null | number;
	createdAt: string;
	createdBy: null | number;
	criticality: CriticalityLevel;
	decommissionedAt: null | string;
	deletedAt: null | string;
	deletedBy: null | number;
	description: null | string;
	documentationUrl: null | string;
	fqdn: null | string;
	hostname: null | string;
	id: number;
	isDeleted: boolean;
	isVirtual: boolean;
	lastVerifiedAt: null | string;
	managementUrl: null | string;
	name: string;
	networkZoneId: null | number;
	notes: null | string;
	operatingSystem: null | string;
	osVersion: null | string;
	parentHostId: null | number;
	plannedReplacementAt: null | string;
	platform: null | string;
	primaryIp: null | string;
	purchaseDate: null | string;
	role: null | string;
	serialNumber: null | string;
	siteId: null | number;
	status: AssetStatus;
	supportContact: null | string;
	supportEndsAt: null | string;
	technicalOwnerId: null | number;
	updatedAt: string;
	updatedBy: null | number;
	vendorId: null | number;
	warrantyExpiresAt: null | string;
	workspaceId: null | number;
}

/**
 * Writable asset fields shared by create and update. Every field is optional;
 * `null` explicitly clears a nullable column while `undefined` leaves it
 * untouched. Mirrors the backend `writableFields` TypeBox schema.
 */
interface AssetWritableFields {
	assetTag?: null | string;
	businessOwnerId?: null | number;
	criticality?: CriticalityLevel;
	decommissionedAt?: null | string;
	description?: null | string;
	documentationUrl?: null | string;
	fqdn?: null | string;
	hostname?: null | string;
	isVirtual?: boolean;
	lastVerifiedAt?: null | string;
	managementUrl?: null | string;
	networkZoneId?: null | number;
	notes?: null | string;
	operatingSystem?: null | string;
	osVersion?: null | string;
	parentHostId?: null | number;
	plannedReplacementAt?: null | string;
	platform?: null | string;
	primaryIp?: null | string;
	purchaseDate?: null | string;
	role?: null | string;
	serialNumber?: null | string;
	siteId?: null | number;
	status?: AssetStatus;
	supportContact?: null | string;
	supportEndsAt?: null | string;
	technicalOwnerId?: null | number;
	vendorId?: null | number;
	warrantyExpiresAt?: null | string;
}

/** Body for creating an asset. Name and asset type are required. */
interface CreateAssetInput extends AssetWritableFields {
	assetType: AssetType;
	name: string;
}

/** Body for updating an asset. All fields optional (partial update). */
type UpdateAssetInput = AssetWritableFields & {
	assetType?: AssetType;
	name?: string;
};

/**
 * Fetch a single asset by id. Requires VIEWER role or higher.
 *
 * @param id - Asset id
 * @param includeDeleted - When true, soft-deleted assets are returned too
 */
function getAsset(id: number, includeDeleted = false): Promise<DataResponse<Asset>> {
	return apiClient.get<DataResponse<Asset>>(
		`/assets/${id}`,
		includeDeleted ? { params: { includeDeleted: 'true' } } : undefined
	);
}

/** Fetch a paginated, filterable list of assets. Requires VIEWER role or higher. */
function listAssets(params?: Record<string, string>): Promise<PaginatedResponse<Asset>> {
	return apiClient.get<PaginatedResponse<Asset>>('/assets', params ? { params } : undefined);
}

/** Create a new asset. Requires OPERATOR role or higher. */
function createAsset(input: CreateAssetInput): Promise<DataResponse<Asset>> {
	return apiClient.post<DataResponse<Asset>>('/assets', { body: input });
}

/** Update an existing asset with a partial patch. Requires OPERATOR role or higher. */
function updateAsset(id: number, input: UpdateAssetInput): Promise<DataResponse<Asset>> {
	return apiClient.patch<DataResponse<Asset>>(`/assets/${id}`, { body: input });
}

/** Soft-delete an asset (recoverable via restore). Requires OPERATOR role or higher. */
function deleteAsset(id: number): Promise<DataResponse<Asset>> {
	return apiClient.delete<DataResponse<Asset>>(`/assets/${id}`);
}

export { createAsset, deleteAsset, getAsset, listAssets, updateAsset };
export type { Asset, AssetWritableFields, CreateAssetInput, UpdateAssetInput };

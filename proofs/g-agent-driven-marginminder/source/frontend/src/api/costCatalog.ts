import type {
	CostCatalogCategory,
	CostCatalogItem,
	CostCatalogItemInput,
	CostCatalogItemUpdateInput,
	DataResponse,
	PaginatedResponse,
	SuccessResponse,
} from './types';

import { apiClient } from './client';

interface ListCostCatalogOptions {
	active?: boolean;
	category?: 'all' | CostCatalogCategory;
	includeArchived?: boolean;
	limit?: number;
	page?: number;
	search?: string;
}

function listCostCatalogItems(
	options: ListCostCatalogOptions = {}
): Promise<PaginatedResponse<CostCatalogItem>> {
	const params: Record<string, string> = {
		includeArchived: String(options.includeArchived ?? false),
		limit: String(options.limit ?? 100),
		page: String(options.page ?? 1),
	};

	if (options.active !== undefined) params.active = String(options.active);
	if (options.category && options.category !== 'all') params.category = options.category;
	if (options.search) params.search = options.search;

	return apiClient.get<PaginatedResponse<CostCatalogItem>>('/cost-catalog', { params });
}

function getCostCatalogItem(id: number): Promise<DataResponse<CostCatalogItem>> {
	return apiClient.get<DataResponse<CostCatalogItem>>(`/cost-catalog/${id}`);
}

function createCostCatalogItem(
	input: CostCatalogItemInput
): Promise<DataResponse<CostCatalogItem>> {
	return apiClient.post<DataResponse<CostCatalogItem>>('/cost-catalog', { body: input });
}

function updateCostCatalogItem(
	id: number,
	input: CostCatalogItemUpdateInput
): Promise<DataResponse<CostCatalogItem>> {
	return apiClient.put<DataResponse<CostCatalogItem>>(`/cost-catalog/${id}`, { body: input });
}

function archiveCostCatalogItem(id: number): Promise<SuccessResponse> {
	return apiClient.delete<SuccessResponse>(`/cost-catalog/${id}`);
}

export {
	archiveCostCatalogItem,
	createCostCatalogItem,
	getCostCatalogItem,
	listCostCatalogItems,
	updateCostCatalogItem,
};
export type { ListCostCatalogOptions };

import type { DataResponse } from './types';

import { apiClient } from './client';

/** An asset hit from global search, with the fields the term matched on. */
interface AssetSearchResult {
	assetType: string;
	criticality: string;
	hostname: null | string;
	id: number;
	matchedFields: string[];
	name: string;
	primaryIp: null | string;
	status: string;
	type: 'asset';
}

/** A service hit from global search, with the fields the term matched on. */
interface ServiceSearchResult {
	category: null | string;
	criticality: string;
	id: number;
	matchedFields: string[];
	name: string;
	type: 'service';
}

/** Typed, grouped global-search payload returned by `GET /search`. */
interface GlobalSearchResults {
	assets: AssetSearchResult[];
	limit: number;
	query: string;
	services: ServiceSearchResult[];
	totalCount: number;
}

/**
 * Run a cross-domain global search across assets and services. Requires VIEWER
 * role or higher; restricted fields are only searched for OPERATOR+ callers.
 *
 * @param term - The search term
 * @param limit - Optional max results per group (1..50)
 */
function globalSearch(term: string, limit?: number): Promise<DataResponse<GlobalSearchResults>> {
	const params: Record<string, string> = { q: term };
	if (limit !== undefined) params.limit = String(limit);
	return apiClient.get<DataResponse<GlobalSearchResults>>('/search', { params });
}

export { globalSearch };
export type { AssetSearchResult, GlobalSearchResults, ServiceSearchResult };

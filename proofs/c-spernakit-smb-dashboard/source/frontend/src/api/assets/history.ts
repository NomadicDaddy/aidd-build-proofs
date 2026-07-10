import type { PaginatedResponse } from '../types';

import { apiClient } from '../client.ts';

/**
 * A single entry in an asset's change-event audit trail, as returned by
 * `GET /assets/:id/history`. Mirrors the backend `asset_change_events` row with
 * the acting user's username resolved and the timestamp serialized to ISO-8601.
 */
interface AssetChangeEvent {
	action: string;
	actorId: null | number;
	actorUsername: null | string;
	assetId: null | number;
	changes: null | Record<string, unknown>;
	createdAt: string;
	entityId: null | number;
	entityType: string;
	id: number;
	importId: null | number;
	summary: null | string;
}

/**
 * Fetch the paginated change-event audit trail for a single asset, newest
 * first. Filterable by action and ISO 8601 date range. Requires VIEWER+.
 *
 * @param id - Asset id
 * @param params - Optional query params (page, limit, action, dateFrom, dateTo)
 */
function getAssetHistory(
	id: number,
	params?: Record<string, string>
): Promise<PaginatedResponse<AssetChangeEvent>> {
	return apiClient.get<PaginatedResponse<AssetChangeEvent>>(
		`/assets/${id}/history`,
		params ? { params } : undefined
	);
}

export { getAssetHistory };
export type { AssetChangeEvent };

import { useQuery } from '@tanstack/react-query';

import type { AssetChangeEvent } from '@/api/assets';
import type { PaginatedResponse } from '@/api/types';

import { getAssetHistory } from '@/api/assets';

/** Number of change events fetched per page of the asset history section. */
const HISTORY_PAGE_LIMIT = 50;

/**
 * Fetch a single asset's change-event audit trail, optionally filtered by
 * action. Enabled only for a valid asset id so the query does not fire while the
 * detail page is still resolving its route param.
 *
 * @param assetId - Asset id whose history to load
 * @param action - Optional action filter (empty string = all actions)
 * @param enabled - Gate the query (e.g. only when the id is valid)
 */
export function useAssetHistory(assetId: number, action: string, enabled: boolean) {
	const params: Record<string, string> = { limit: String(HISTORY_PAGE_LIMIT) };
	if (action) params.action = action;

	return useQuery<PaginatedResponse<AssetChangeEvent>, Error>({
		enabled,
		queryFn: () => getAssetHistory(assetId, params),
		queryKey: ['asset-history', assetId, action],
	});
}

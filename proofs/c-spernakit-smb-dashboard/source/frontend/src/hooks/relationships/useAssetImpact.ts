import { useQuery } from '@tanstack/react-query';

import { getAssetImpact } from '@/api/impact';

/**
 * Impact analysis for a single asset — its upstream dependencies, the assets that
 * break if it goes offline, and the business services affected. Backed by the
 * `/relationships/impact/:assetId` endpoint. Enabled only for a valid asset id so
 * the asset detail Relationships tab defers the query until the id resolves.
 */
export function useAssetImpact(assetId: number, enabled: boolean) {
	return useQuery({
		enabled,
		queryFn: () => getAssetImpact(assetId),
		queryKey: ['asset-impact', assetId],
	});
}

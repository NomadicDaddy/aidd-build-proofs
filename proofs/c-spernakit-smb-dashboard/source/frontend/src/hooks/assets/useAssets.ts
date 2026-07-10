import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateAssetInput, UpdateAssetInput } from '@/api/assets';

import { createAsset, deleteAsset, listAssets, updateAsset } from '@/api/assets';
import { stdCallbacks } from '@/lib/mutationHelpers';

/** URL-filter values that drive the inventory query. Empty strings are omitted. */
interface AssetListFilters {
	criticality: string;
	/** Port exposure level (internal, dmz, internet, unknown). */
	exposureLevel: string;
	/** Exact port number an asset must expose. */
	portNumber: string;
	/** Port transport protocol (tcp, udp, icmp, other). */
	protocol: string;
	/** Port review state (expected, unexpected, ignored, historical, needs_review). */
	reviewState: string;
	search: string;
	/** Catalog service id an exposed port must be attributed to. */
	serviceId: string;
	status: string;
	type: string;
}

/**
 * Data + mutations for the asset inventory page.
 *
 * Wraps the inventory list query (server-side pagination + filters) and the
 * create / update / soft-delete mutations, invalidating the `assets` query key
 * on every successful write so the table refreshes.
 */
export function useAssets(page: number, limit: number, filters: AssetListFilters) {
	const queryClient = useQueryClient();

	const queryParams: Record<string, string> = { limit: String(limit), page: String(page) };
	if (filters.search) queryParams.search = filters.search;
	if (filters.type) queryParams.type = filters.type;
	if (filters.status) queryParams.status = filters.status;
	if (filters.criticality) queryParams.criticality = filters.criticality;
	if (filters.protocol) queryParams.protocol = filters.protocol;
	if (filters.exposureLevel) queryParams.exposureLevel = filters.exposureLevel;
	if (filters.reviewState) queryParams.reviewState = filters.reviewState;
	if (filters.portNumber) queryParams.portNumber = filters.portNumber;
	if (filters.serviceId) queryParams.serviceId = filters.serviceId;

	const { data, isLoading } = useQuery({
		queryFn: () => listAssets(queryParams),
		queryKey: [
			'assets',
			page,
			limit,
			filters.search,
			filters.type,
			filters.status,
			filters.criticality,
			filters.protocol,
			filters.exposureLevel,
			filters.reviewState,
			filters.portNumber,
			filters.serviceId,
		],
	});

	const cb = (success: string, error: string) =>
		stdCallbacks(queryClient, {
			errorMessage: error,
			invalidateKeys: [['assets']],
			successMessage: success,
		});

	const createMutation = useMutation({
		mutationFn: (input: CreateAssetInput) => createAsset(input),
		...cb('Asset created', 'Failed to create asset. Check the input fields and try again.'),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: UpdateAssetInput }) =>
			updateAsset(id, input),
		...cb('Asset updated', 'Failed to update asset. Review the changes and try again.'),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteAsset(id),
		...cb('Asset deleted', 'Failed to delete asset. Refresh the list and try again.'),
	});

	return { createMutation, data, deleteMutation, isLoading, updateMutation };
}

export type { AssetListFilters };

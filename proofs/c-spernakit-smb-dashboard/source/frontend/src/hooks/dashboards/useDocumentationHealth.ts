import type { DocumentationHealthSignal } from 'spernakit-shared';

import { useQuery } from '@tanstack/react-query';

import { getDocumentationHealth, getDocumentationHealthAssets } from '@/api/documentationHealth';

/**
 * Query hook for the documentation-health signal counts
 * (`GET /infrastructure/documentation-health`). Enabled only for users with
 * dashboard access.
 */
export function useDocumentationHealth(enabled = true, thresholdDays?: number) {
	const { data, isError, isLoading } = useQuery({
		enabled,
		queryFn: async () => {
			const res = await getDocumentationHealth(thresholdDays);
			return res.data;
		},
		queryKey: ['documentation-health', thresholdDays ?? null],
		staleTime: 30_000,
		throwOnError: false,
	});

	return { health: data, isError, isLoading };
}

/**
 * Query hook for the assets flagged by a single documentation-health signal
 * (`GET /infrastructure/documentation-health/assets`). Fetches lazily — only when
 * a signal is selected — so the dashboard does not load six lists up front.
 */
export function useDocumentationHealthAssets(
	signal: DocumentationHealthSignal | null,
	thresholdDays?: number
) {
	const { data, isError, isLoading } = useQuery({
		enabled: signal !== null,
		queryFn: async () => {
			const res = await getDocumentationHealthAssets(signal!, {
				limit: '25',
				...(thresholdDays !== undefined ? { thresholdDays: String(thresholdDays) } : {}),
			});
			return res;
		},
		queryKey: ['documentation-health-assets', signal, thresholdDays ?? null],
		staleTime: 30_000,
		throwOnError: false,
	});

	return { assets: data?.data ?? [], isError, isLoading, total: data?.total ?? 0 };
}

import type { DocumentationHealthSignal } from 'spernakit-shared';

import type { Asset } from './assets';
import type { DataResponse, PaginatedResponse } from './types';

import { apiClient } from './client';

/**
 * Documentation-health signal counts for the live inventory. Mirrors the backend
 * `DocumentationHealthSummary` returned by `GET /infrastructure/documentation-health`.
 */
interface DocumentationHealthSummary {
	signals: Record<DocumentationHealthSignal, number>;
	thresholdDays: number;
	totalAssets: number;
}

/**
 * Fetch the documentation-health signal counts. Requires VIEWER role or higher.
 *
 * @param thresholdDays - Optional stale-data threshold override (days)
 */
function getDocumentationHealth(
	thresholdDays?: number
): Promise<DataResponse<DocumentationHealthSummary>> {
	return apiClient.get<DataResponse<DocumentationHealthSummary>>(
		'/infrastructure/documentation-health',
		thresholdDays !== undefined
			? { params: { thresholdDays: String(thresholdDays) } }
			: undefined
	);
}

/**
 * Fetch the paginated, name-ordered list of assets flagged by a single
 * documentation-health signal (the drill-in filterable list view). Requires
 * VIEWER role or higher.
 *
 * @param signal - Which documentation gap to list assets for
 * @param params - Optional query params (page, limit, thresholdDays)
 */
function getDocumentationHealthAssets(
	signal: DocumentationHealthSignal,
	params?: Record<string, string>
): Promise<PaginatedResponse<Asset>> {
	return apiClient.get<PaginatedResponse<Asset>>('/infrastructure/documentation-health/assets', {
		params: { signal, ...params },
	});
}

export { getDocumentationHealth, getDocumentationHealthAssets };
export type { DocumentationHealthSummary };

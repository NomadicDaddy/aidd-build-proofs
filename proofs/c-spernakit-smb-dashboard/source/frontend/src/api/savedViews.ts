import type { DataResponse, SuccessResponse } from './types';

import { apiClient } from './client';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A saved inventory filter view. `filters` is a map of inventory URL filter keys
 * (type, status, criticality, …) to their string values, re-applied to the
 * asset inventory page when the view is loaded.
 */
interface SavedView {
	createdAt: string;
	filters: Record<string, string>;
	id: number;
	name: string;
	updatedAt: string;
	userId: number;
	workspaceId: null | number;
}

/** Payload for creating or updating a saved view. */
interface SavedViewInput {
	filters: Record<string, string>;
	name: string;
}

/* -------------------------------------------------------------------------- */
/*  API functions                                                             */
/* -------------------------------------------------------------------------- */

/** List the authenticated user's saved views in the active workspace. */
function listSavedViews(): Promise<DataResponse<SavedView[]>> {
	return apiClient.get<DataResponse<SavedView[]>>('/saved-views');
}

/** Create a new saved view from the current inventory filters. */
function createSavedView(input: SavedViewInput): Promise<DataResponse<SavedView>> {
	return apiClient.post<DataResponse<SavedView>>('/saved-views', { body: input });
}

/** Update an existing saved view's name and/or filters. */
function updateSavedView(id: number, input: SavedViewInput): Promise<DataResponse<SavedView>> {
	return apiClient.put<DataResponse<SavedView>>(`/saved-views/${id}`, { body: input });
}

/** Soft-delete a saved view. */
function deleteSavedView(id: number): Promise<SuccessResponse> {
	return apiClient.delete<SuccessResponse>(`/saved-views/${id}`);
}

export { createSavedView, deleteSavedView, listSavedViews, updateSavedView };
export type { SavedView, SavedViewInput };

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SavedView, SavedViewInput } from '@/api/savedViews';

import {
	createSavedView,
	deleteSavedView,
	listSavedViews,
	updateSavedView,
} from '@/api/savedViews';
import { stdCallbacks } from '@/lib/mutationHelpers';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Queries and mutations for the current user's saved inventory views.
 *
 * The list query is keyed by the active workspace so switching workspaces shows
 * the correct per-tenant views. Every write invalidates that key so the saved
 * views dropdown refreshes immediately.
 */
export function useSavedViews() {
	const queryClient = useQueryClient();
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
	const queryKey = ['saved-views', activeWorkspaceId] as const;

	const { data, isLoading } = useQuery({
		enabled: activeWorkspaceId !== null,
		queryFn: listSavedViews,
		queryKey,
		select: (response) => response.data,
		// Saved views are auxiliary to the inventory table: a fetch failure must
		// degrade to an empty list (dropdown shows "No saved views yet"), never
		// crash the whole inventory page to the error boundary.
		throwOnError: false,
	});

	const createMutation = useMutation({
		mutationFn: (input: SavedViewInput) => createSavedView(input),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to save view',
			invalidateKeys: [queryKey],
			successMessage: 'View saved',
		}),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: SavedViewInput }) =>
			updateSavedView(id, input),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to update view',
			invalidateKeys: [queryKey],
			successMessage: 'View updated',
		}),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteSavedView(id),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to delete view',
			invalidateKeys: [queryKey],
			successMessage: 'View deleted',
		}),
	});

	const views: SavedView[] = data ?? [];

	return { createMutation, deleteMutation, isLoading, updateMutation, views };
}

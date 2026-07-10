import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Turn any thrown value into a human-readable message for a toast. `ApiError`
 * (and other `Error`s) carry a useful `.message`; anything else falls back to a
 * generic line so the user still gets clear feedback.
 */
function toErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return 'Something went wrong. Please try again.';
}

/**
 * Shared TanStack Query client for the app. Kept at module scope so the same
 * cache is reused across renders and available to non-component callers.
 *
 * A `MutationCache` `onError` surfaces every failed mutation as an error toast
 * in one place, so individual mutations only handle their own success feedback
 * and any state rollback.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30_000,
		},
	},
	mutationCache: new MutationCache({
		onError: (error) => {
			toast.error(toErrorMessage(error));
		},
	}),
});

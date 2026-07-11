import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { preconnect } from 'react-dom';
import { RouterProvider } from 'react-router-dom';

import { ApiError } from '@/api/apiError';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { useSyncUiSettings } from '@/hooks/useSyncUiSettings';
import { useTheme } from '@/hooks/useTheme';
import { router } from '@/routes';

/**
 * Never retry 429 at the TanStack level — the fetch-level retryHandler already
 * retries 429 with Retry-After backoff. Stacking TanStack retries on top would
 * only worsen the rate-limit window.
 */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
	if (error instanceof ApiError && error.status === 429) return false;
	return failureCount < 3;
}

/**
 * Throw query errors into the nearest React ErrorBoundary so pages that don't
 * explicitly handle `isError` still show a recoverable "Something went wrong"
 * fallback instead of an empty or stale content area.
 *
 * Only throws after all retries are exhausted (TanStack calls this on final failure).
 * Does not throw for 401 (handled by token refresh / redirect) or 403 (permission
 * checks are page-level concerns).
 */
function shouldThrowOnError(error: Error): boolean {
	if (error instanceof ApiError) {
		if (error.status === 401 || error.status === 403) return false;
	}
	return true;
}

/**
 * Global QueryClient with optimized defaults for caching and deduplication.
 *
 * - staleTime: Data is fresh for 5 minutes (reduces refetches)
 * - gcTime: Cached data retained for 10 minutes after becoming unused
 * - retry: Failed queries retry 3 times with exponential backoff, except 429
 * - refetchOnWindowFocus: Disabled to prevent unnecessary network traffic
 *
 * TanStack Query automatically deduplicates in-flight requests with the same query key.
 */
const queryClient = new QueryClient({
	defaultOptions: {
		mutations: {
			retry: 1,
		},
		queries: {
			gcTime: 10 * 60 * 1000, // 10 minutes cache retention
			refetchOnWindowFocus: false,
			retry: shouldRetryQuery,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
			staleTime: 5 * 60 * 1000, // 5 minutes before data is considered stale
			throwOnError: shouldThrowOnError,
		},
	},
});

function ThemeApplicator({ children }: { children: ReactNode }) {
	useTheme();
	useSyncUiSettings();
	return <>{children}</>;
}

preconnect(window.location.origin);

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeApplicator>
				<ErrorBoundary>
					<RouterProvider router={router} />
				</ErrorBoundary>
				<Toaster />
			</ThemeApplicator>
		</QueryClientProvider>
	);
}

export { App };

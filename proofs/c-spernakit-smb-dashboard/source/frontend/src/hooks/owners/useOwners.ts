import { useQuery } from '@tanstack/react-query';

import { listOwners } from '@/api/owners';

/** Options for {@link useOwners}. */
interface UseOwnersOptions {
	/**
	 * When `false`, a failed owners fetch resolves to an error state instead of
	 * throwing into the nearest error boundary. Use this where the owner list is
	 * an optional enhancement (e.g. a filter dropdown) and its absence should not
	 * take down the whole page. Defaults to the global throw-on-error behaviour.
	 */
	throwOnError?: boolean;
}

/**
 * Fetch the list of active owners for populating owner selectors on the service
 * catalog and asset forms. Owners change rarely, so the result is held for a
 * while before refetching.
 */
export function useOwners(options: UseOwnersOptions = {}) {
	return useQuery({
		queryFn: () => listOwners(),
		queryKey: ['owners'],
		staleTime: 5 * 60 * 1000,
		...(options.throwOnError === undefined ? {} : { throwOnError: options.throwOnError }),
	});
}

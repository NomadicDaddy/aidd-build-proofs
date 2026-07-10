import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { globalSearch } from '@/api/search';

/** Minimum term length before a search request is issued. */
const MIN_SEARCH_LENGTH = 2;

/**
 * Global-search query. Only fires once the (already-debounced) term has at least
 * {@link MIN_SEARCH_LENGTH} non-whitespace characters, and keeps the previous
 * results visible while a new term is in flight to avoid flicker.
 *
 * @param term - The debounced search term
 */
export function useGlobalSearch(term: string) {
	const trimmed = term.trim();
	const enabled = trimmed.length >= MIN_SEARCH_LENGTH;

	const { data, isFetching } = useQuery({
		enabled,
		placeholderData: keepPreviousData,
		queryFn: () => globalSearch(trimmed),
		queryKey: ['global-search', trimmed],
	});

	return { enabled, isFetching, results: data?.data ?? null };
}

export { MIN_SEARCH_LENGTH };

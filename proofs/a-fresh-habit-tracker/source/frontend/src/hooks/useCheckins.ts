/**
 * TanStack Query hooks for check-ins: list a habit's check-ins, derive its
 * stats, and toggle a day's check-in. The toggle mutation invalidates both the
 * habit's check-in query and the habit list so streaks and grids refresh.
 */
import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from '@tanstack/react-query';

import { listCheckins, markCheckin, unmarkCheckin } from '@/api/checkins';
import { queryKeys } from '@/api/queryKeys';
import { getHabitStats } from '@/api/stats';
import { type Checkin, type HabitStats } from '@/api/types';

/** Variables for the toggle-check-in mutation. */
export interface ToggleCheckinVariables {
	date: string;
	done: boolean;
	habitId: string;
}

/** Snapshot captured in `onMutate` so a failed toggle can restore the cache. */
interface ToggleCheckinContext {
	previous: Checkin[] | undefined;
}

/** Query a habit's check-ins (disabled for an empty id). */
export function useCheckins(habitId: string): UseQueryResult<Checkin[]> {
	return useQuery({
		enabled: habitId.length > 0,
		queryFn: ({ signal }) => listCheckins(habitId, signal),
		queryKey: queryKeys.checkins(habitId),
	});
}

/** Fetch server-computed streak and completion stats for a habit. */
export function useHabitStats(habitId: string): UseQueryResult<HabitStats> {
	return useQuery({
		enabled: habitId.length > 0,
		queryFn: ({ signal }) => getHabitStats(habitId, signal),
		queryKey: queryKeys.stats(habitId),
	});
}

/**
 * Toggle a habit's check-in for a day: mark when `done`, unmark otherwise. The
 * cache is updated optimistically so the button and grid flip instantly; if the
 * request fails the snapshot is restored (surfacing the change as reverted) and
 * the shared error toast reports the failure.
 */
export function useToggleCheckin(): UseMutationResult<
	Checkin | void,
	Error,
	ToggleCheckinVariables,
	ToggleCheckinContext
> {
	const client = useQueryClient();
	return useMutation<Checkin | void, Error, ToggleCheckinVariables, ToggleCheckinContext>({
		mutationFn: ({ date, done, habitId }) =>
			done ? markCheckin(habitId, date) : unmarkCheckin(habitId, date),
		onError: (_error, { habitId }, context) => {
			if (context !== undefined) {
				client.setQueryData(queryKeys.checkins(habitId), context.previous);
			}
		},
		onMutate: async ({ date, done, habitId }) => {
			const key = queryKeys.checkins(habitId);
			await client.cancelQueries({ queryKey: key });
			const previous = client.getQueryData<Checkin[]>(key);

			client.setQueryData<Checkin[]>(key, (current) => {
				const rows = current ?? [];
				if (done) {
					if (rows.some((checkin) => checkin.date === date)) return rows;
					const optimistic: Checkin = {
						createdAt: new Date().toISOString(),
						date,
						habitId,
						id: `optimistic-${date}`,
					};
					return [...rows, optimistic];
				}
				return rows.filter((checkin) => checkin.date !== date);
			});

			return { previous };
		},
		onSettled: (_result, _error, { habitId }) => {
			void client.invalidateQueries({ queryKey: queryKeys.checkins(habitId) });
			void client.invalidateQueries({ queryKey: queryKeys.habits });
		},
	});
}

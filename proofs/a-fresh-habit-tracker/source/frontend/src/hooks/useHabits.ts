/**
 * TanStack Query hooks for habits: list, single fetch, and the create / update /
 * archive mutations. Mutations invalidate the habit queries on success so any
 * mounted list or detail view refetches automatically.
 */
import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { archiveHabit, createHabit, getHabit, listHabits, updateHabit } from '@/api/habits';
import { queryKeys } from '@/api/queryKeys';
import { type CreateHabitInput, type Habit, type UpdateHabitInput } from '@/api/types';

/** Variables for the update-habit mutation. */
export interface UpdateHabitVariables {
	id: string;
	input: UpdateHabitInput;
}

/** Query all non-archived habits. */
export function useHabits(): UseQueryResult<Habit[]> {
	return useQuery({
		queryFn: ({ signal }) => listHabits(signal),
		queryKey: queryKeys.habits,
	});
}

/** Query a single habit by id (disabled for an empty id). */
export function useHabit(id: string): UseQueryResult<Habit> {
	return useQuery({
		enabled: id.length > 0,
		queryFn: ({ signal }) => getHabit(id, signal),
		queryKey: queryKeys.habit(id),
	});
}

/** Create a habit, refreshing the habit list on success. */
export function useCreateHabit(): UseMutationResult<Habit, Error, CreateHabitInput> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateHabitInput) => createHabit(input),
		onSuccess: (habit) => {
			toast.success(`Added “${habit.name}”.`);
			void client.invalidateQueries({ queryKey: queryKeys.habits });
		},
	});
}

/** Update a habit, refreshing the list and that habit's detail on success. */
export function useUpdateHabit(): UseMutationResult<Habit, Error, UpdateHabitVariables> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: UpdateHabitVariables) => updateHabit(id, input),
		onSuccess: (habit) => {
			toast.success(`Saved changes to “${habit.name}”.`);
			void client.invalidateQueries({ queryKey: queryKeys.habits });
			void client.invalidateQueries({ queryKey: queryKeys.habit(habit.id) });
		},
	});
}

/** Archive a habit, refreshing the list and that habit's detail on success. */
export function useArchiveHabit(): UseMutationResult<Habit, Error, string> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => archiveHabit(id),
		onSuccess: (habit) => {
			toast.success(`Archived “${habit.name}”.`);
			void client.invalidateQueries({ queryKey: queryKeys.habits });
			void client.invalidateQueries({ queryKey: queryKeys.habit(habit.id) });
		},
	});
}

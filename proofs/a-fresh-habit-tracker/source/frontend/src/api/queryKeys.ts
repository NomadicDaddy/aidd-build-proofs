/**
 * Centralized TanStack Query keys. Keeping them in one place ensures hooks and
 * their invalidations stay in sync. Note the keys are prefix-nested under
 * `['habits']`, so invalidating `queryKeys.habits` also refreshes individual
 * habit and check-in queries.
 */
export const queryKeys = {
	checkins: (habitId: string) => ['habits', habitId, 'checkins'] as const,
	habit: (id: string) => ['habits', id] as const,
	habits: ['habits'] as const,
	stats: (habitId: string) => ['habits', habitId, 'stats'] as const,
};

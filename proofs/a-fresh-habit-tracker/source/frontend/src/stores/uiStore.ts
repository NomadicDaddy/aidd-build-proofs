import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface UiState {
	setTheme: (theme: ThemeMode) => void;
	theme: ThemeMode;
	toggleTheme: () => void;
}

/**
 * Client-only UI state (persisted). Currently tracks the light/dark theme,
 * which the root layout applies to `document.documentElement`.
 */
export const useUiStore = create<UiState>()(
	persist(
		(set) => ({
			setTheme: (theme) => set({ theme }),
			theme: 'light',
			toggleTheme: () =>
				set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
		}),
		{ name: 'habit-tracker-ui' }
	)
);

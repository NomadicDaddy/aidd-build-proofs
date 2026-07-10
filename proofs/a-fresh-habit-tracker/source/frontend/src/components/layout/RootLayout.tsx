import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

const NAV_LINKS = [
	{ label: 'Dashboard', to: '/' },
	{ label: 'Habits', to: '/habits' },
] as const;

/**
 * App shell: applies the persisted theme to the document root and renders a
 * header plus the routed page via <Outlet />.
 */
export function RootLayout() {
	const theme = useUiStore((state) => state.theme);
	const toggleTheme = useUiStore((state) => state.toggleTheme);

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}, [theme]);

	return (
		<div className="bg-background text-foreground min-h-screen">
			<header className="border-border border-b">
				<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
					<div className="flex items-center gap-3 sm:gap-6">
						<span className="text-lg font-semibold">Habit Tracker</span>
						<nav aria-label="Primary" className="flex items-center gap-1">
							{NAV_LINKS.map((link) => (
								<NavLink
									className={({ isActive }) =>
										cn(
											'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
											isActive
												? 'bg-accent text-accent-foreground'
												: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
										)
									}
									end={link.to === '/'}
									key={link.to}
									to={link.to}>
									{link.label}
								</NavLink>
							))}
						</nav>
					</div>
					<button
						aria-label="Toggle theme"
						className={cn(
							'border-border inline-flex size-9 items-center justify-center rounded-md border',
							'text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
						)}
						onClick={toggleTheme}
						type="button">
						{theme === 'dark' ? (
							<Sun className="size-4" />
						) : (
							<Moon className="size-4" />
						)}
					</button>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
				<Outlet />
			</main>
		</div>
	);
}

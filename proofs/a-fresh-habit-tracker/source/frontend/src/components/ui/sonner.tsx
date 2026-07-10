/**
 * App toast surface built on `sonner`, styled with the project's design tokens.
 * Follows the light/dark theme from the shared UI store (instead of the shadcn
 * default `next-themes`, which this app does not use) so toasts match the page.
 */
import { type ComponentProps, type CSSProperties } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

import { useUiStore } from '@/stores/uiStore';

type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
	const theme = useUiStore((state) => state.theme);

	return (
		<SonnerToaster
			className="toaster group"
			richColors
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-border': 'var(--border)',
					'--normal-text': 'var(--popover-foreground)',
				} as CSSProperties
			}
			theme={theme}
			{...props}
		/>
	);
}

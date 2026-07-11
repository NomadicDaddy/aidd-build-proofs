import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
	children?: ReactNode;
	className?: string;
	description?: ReactNode;
	eyebrow?: string;
	icon?: LucideIcon;
	title: ReactNode;
}

/**
 * Standard page header primitive. Renders an optional eyebrow, a display-font
 * title, an optional lead description, and a trailing action slot (children).
 * Used at the top of most pages in the app.
 */
function PageHeader({
	children,
	className,
	description,
	eyebrow,
	icon: Icon,
	title,
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				'border-border/60 flex flex-col gap-4 pb-6 md:flex-row md:items-start md:justify-between md:border-b',
				className
			)}>
			<div className="flex min-w-0 items-start gap-3">
				{Icon && (
					<div className="bg-muted/60 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
						<Icon aria-hidden="true" className="size-5" />
					</div>
				)}
				<div className="min-w-0 flex-1 space-y-1">
					{eyebrow && <p className="text-eyebrow">{eyebrow}</p>}
					<h1 className="text-display text-balance">{title}</h1>
					{description && <p className="text-lead">{description}</p>}
				</div>
			</div>
			{children && (
				<div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
			)}
		</div>
	);
}

export { PageHeader };

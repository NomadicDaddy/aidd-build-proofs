import type { ReactNode } from 'react';

interface FieldProps {
	label: string;
	value: ReactNode;
}

/** A single labelled fact rendered in a responsive definition grid. */
export function Field({ label, value }: FieldProps) {
	const isEmpty = value === null || value === undefined || value === '' || value === '—';
	return (
		<div className="space-y-0.5">
			<dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
				{label}
			</dt>
			<dd className={isEmpty ? 'text-muted-foreground text-sm' : 'text-sm break-words'}>
				{isEmpty ? '—' : value}
			</dd>
		</div>
	);
}

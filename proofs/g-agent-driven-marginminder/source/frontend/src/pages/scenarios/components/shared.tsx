import { TriangleAlert } from 'lucide-react';

import type { ScenarioRiskFlag } from '@/api/types';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { RISK_LABELS } from './types';

interface FieldProps {
	children: React.ReactNode;
	className?: string;
	error?: string | undefined;
	label: string;
}

export function Field({ children, className, error, label }: FieldProps) {
	return (
		<div className={cn('space-y-1.5', className)}>
			<Label>{label}</Label>
			{children}
			{error && <p className="text-destructive text-xs">{error}</p>}
		</div>
	);
}

export function InlineFieldError({ error }: { error?: string | undefined }) {
	if (!error) return null;

	return <p className="text-destructive mt-1 text-xs">{error}</p>;
}

export function SummaryMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border p-3">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="text-lg font-semibold">{value}</div>
		</div>
	);
}

export function RiskFlagBadges({ flags }: { flags: ScenarioRiskFlag[] }) {
	if (flags.length === 0) {
		return <span className="text-muted-foreground text-sm">No current warnings</span>;
	}

	return (
		<div className="flex flex-wrap gap-2">
			{flags.map((flag) => (
				<Badge
					className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-200"
					key={flag.code}
					title={flag.message}
					variant="outline">
					<TriangleAlert aria-hidden="true" className="size-3" />
					{RISK_LABELS[flag.code]}
				</Badge>
			))}
		</div>
	);
}

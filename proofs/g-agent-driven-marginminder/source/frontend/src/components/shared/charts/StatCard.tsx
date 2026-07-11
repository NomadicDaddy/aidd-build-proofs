import type { ReactNode } from 'react';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StatCardTrend {
	label: string;
	value: number;
}

interface StatCardProps {
	icon: ReactNode;
	/** Optional index used to stagger the entrance animation in a grid of stat cards. */
	index?: number;
	/** Optional progress value (0-100) to show a progress bar below the value. */
	progress?: number;
	/** Optional subtitle text displayed below the value. */
	subtitle?: string;
	title: string;
	/** Optional trend indicator shown below the value. */
	trend?: StatCardTrend;
	value: number | string;
	/** Optional visual variant for the card. */
	variant?: 'default' | 'destructive' | 'success' | 'warning';
}

const variantCardClasses: Record<string, string> = {
	default: '',
	destructive: 'border-destructive/50 bg-gradient-to-br from-destructive/8 to-card',
	success:
		'border-[oklch(0.723_0.219_149/20%)] bg-gradient-to-br from-[oklch(0.723_0.219_149/8%)] to-card',
	warning:
		'border-[oklch(0.795_0.184_86/20%)] bg-gradient-to-br from-[oklch(0.795_0.184_86/8%)] to-card',
};

const variantIconClasses: Record<string, string> = {
	default: '',
	destructive: 'rounded-xl bg-destructive/10 p-2',
	success: 'rounded-xl bg-[oklch(0.723_0.219_149/15%)] p-2',
	warning: 'rounded-xl bg-[oklch(0.795_0.184_86/15%)] p-2',
};

function TrendIndicator({ trend }: { trend: StatCardTrend }) {
	const Icon = trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus;
	const color =
		trend.value > 0
			? 'text-[oklch(0.723_0.219_149)]'
			: trend.value < 0
				? 'text-destructive'
				: 'text-muted-foreground';

	return (
		<div className={cn('mt-2 flex items-center gap-1', color)}>
			<Icon aria-hidden="true" className="size-4" />
			<span className="text-sm font-medium">{Math.abs(trend.value)}%</span>
			<span className="text-muted-foreground text-xs">{trend.label}</span>
		</div>
	);
}

export function StatCard({
	icon,
	index,
	progress,
	subtitle,
	title,
	trend,
	value,
	variant = 'default',
}: StatCardProps) {
	const hasVariant = variant !== 'default';

	return (
		<Card
			className={cn(
				'animate-fade-up',
				variantCardClasses[variant],
				hasVariant && 'transition-transform duration-200 hover:scale-[1.02]'
			)}
			style={index !== undefined ? { animationDelay: `${index * 40}ms` } : undefined}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<div className={cn(variantIconClasses[variant])}>{icon}</div>
			</CardHeader>
			<CardContent className={progress !== undefined ? 'space-y-2' : undefined}>
				<div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
				{subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
				{trend && <TrendIndicator trend={trend} />}
				{progress !== undefined && <Progress value={progress} />}
			</CardContent>
		</Card>
	);
}

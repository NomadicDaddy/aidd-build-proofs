import { cn } from '@/lib/utils';

type StrengthLevel = 'fair' | 'good' | 'strong' | 'weak';

interface PasswordStrengthIndicatorProps {
	className?: string;
	password: string;
}

function calculateStrength(password: string): { level: StrengthLevel; score: number } {
	if (!password) {
		return { level: 'weak', score: 0 };
	}

	let score = 0;

	if (password.length >= 8) score += 1;
	if (password.length >= 12) score += 1;
	if (password.length >= 16) score += 1;
	if (/[a-z]/.test(password)) score += 1;
	if (/[A-Z]/.test(password)) score += 1;
	if (/[0-9]/.test(password)) score += 1;
	if (/[^a-zA-Z0-9]/.test(password)) score += 1;

	let level: StrengthLevel;
	if (score <= 2) {
		level = 'weak';
	} else if (score <= 4) {
		level = 'fair';
	} else if (score <= 5) {
		level = 'good';
	} else {
		level = 'strong';
	}

	return { level, score };
}

const strengthConfig: Record<StrengthLevel, { barClass: string; color: string; label: string }> = {
	fair: { barClass: 'bg-orange-500', color: 'text-orange-500', label: 'Fair' },
	good: { barClass: 'bg-yellow-500', color: 'text-yellow-500', label: 'Good' },
	strong: { barClass: 'bg-green-500', color: 'text-green-500', label: 'Strong' },
	weak: { barClass: 'bg-red-500', color: 'text-red-500', label: 'Weak' },
};

function PasswordStrengthIndicator({ className, password }: PasswordStrengthIndicatorProps) {
	const { level, score } = calculateStrength(password);

	if (!password) {
		return null;
	}

	const config = strengthConfig[level];
	const maxScore = 7;
	const percentage = (score / maxScore) * 100;

	return (
		<div aria-live="polite" className={cn('space-y-1', className)}>
			<div className="bg-muted flex h-1.5 w-full overflow-hidden rounded-full">
				<div
					className={cn(
						'w-full origin-left transition-[transform,background-color] duration-300',
						config.barClass
					)}
					style={{ transform: `scaleX(${percentage / 100})` }}
				/>
			</div>
			<p className={cn('text-xs', config.color)}>
				Password strength: <span className="font-medium">{config.label}</span>
			</p>
		</div>
	);
}

export { PasswordStrengthIndicator };
export type { PasswordStrengthIndicatorProps };

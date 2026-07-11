import type { HealthCheckConfig } from '@/api/health';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

interface HealthConfigSectionProps {
	config: HealthCheckConfig | undefined;
	configLoading: boolean;
	updateConfigMutation: {
		isPending: boolean;
		mutate: (updates: Partial<HealthCheckConfig>) => void;
	};
}

const thresholdFields = [
	{
		description: 'Heap usage percentage above which memory is marked unhealthy',
		id: 'memoryUnhealthy',
		key: 'memoryHeapUnhealthyThreshold' as const,
		label: 'Memory Unhealthy Threshold (%)',
	},
	{
		description: 'Heap usage percentage above which memory is marked degraded',
		id: 'memoryDegraded',
		key: 'memoryHeapDegradedThreshold' as const,
		label: 'Memory Degraded Threshold (%)',
	},
] as const;

const enabledChecks = [
	{ key: 'database', label: 'Database' },
	{ key: 'memory', label: 'Memory' },
	{ key: 'filesystem', label: 'Filesystem' },
] as const;

export function HealthConfigSection({
	config,
	configLoading,
	updateConfigMutation,
}: HealthConfigSectionProps) {
	const { isPending, mutate } = updateConfigMutation;

	function handleThresholdChange(key: (typeof thresholdFields)[number]['key'], raw: string) {
		const value = Number.parseInt(raw, 10);
		if (value >= 0 && value <= 100) {
			void mutate({ [key]: value / 100 });
		}
	}

	function handleToggle(key: string, checked: boolean) {
		void mutate({ enabled: { ...config?.enabled, [key]: checked } });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Health Check Configuration</CardTitle>
				<CardDescription>
					Configure health check thresholds, enable/disable checks, and set log retention.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{configLoading ? (
					<Skeleton className="h-32 w-full" />
				) : (
					<>
						<div className="grid gap-4 md:grid-cols-2">
							{thresholdFields.map((field) => (
								<div className="space-y-2" key={field.id}>
									<Label htmlFor={field.id}>{field.label}</Label>
									<Input
										autoComplete="off"
										disabled={isPending}
										id={field.id}
										max="100"
										min="0"
										onChange={(e) =>
											handleThresholdChange(field.key, e.target.value)
										}
										step="1"
										type="number"
										value={
											config?.[field.key]
												? Math.round(config[field.key] * 100)
												: ''
										}
									/>
									<p className="text-muted-foreground text-xs">
										{field.description}
									</p>
								</div>
							))}
						</div>
						<div className="space-y-2">
							<Label htmlFor="logRetention">Log Retention (Days)</Label>
							<Input
								autoComplete="off"
								disabled={isPending}
								id="logRetention"
								min="1"
								onChange={(e) => {
									const value = Number.parseInt(e.target.value, 10);
									if (value >= 1) {
										void mutate({ logRetentionDays: value });
									}
								}}
								step="1"
								type="number"
								value={config?.logRetentionDays ?? 30}
							/>
							<p className="text-muted-foreground text-xs">
								Health check logs older than this will be automatically cleaned up
							</p>
						</div>
						<div className="space-y-3">
							<Label>Enabled Checks</Label>
							<div className="grid gap-2 sm:grid-cols-3">
								{enabledChecks.map((check) => (
									<div className="flex items-center gap-2" key={check.key}>
										<Switch
											checked={config?.enabled?.[check.key] ?? true}
											disabled={isPending}
											id={`check-${check.key}`}
											onCheckedChange={(checked) =>
												handleToggle(check.key, checked)
											}
										/>
										<Label className="text-sm" htmlFor={`check-${check.key}`}>
											{check.label}
										</Label>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

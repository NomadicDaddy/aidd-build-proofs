import type { RequirableAssetField } from 'spernakit-shared';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
	IMPORT_DUPLICATE_STRATEGIES,
	MAX_STALE_THRESHOLD_DAYS,
	MIN_STALE_THRESHOLD_DAYS,
	REQUIRABLE_ASSET_FIELDS,
} from 'spernakit-shared';

import type { InfrastructureSettings } from '@/api/infrastructureSettings';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
	useInfrastructureSettings,
	useUpdateInfrastructureSettings,
} from '@/hooks/settings/useInfrastructureSettings';

import type { DashboardFilters } from './infrastructureSettingsLabels.ts';

import { InfrastructureDashboardFiltersCard } from './InfrastructureDashboardFiltersCard.tsx';
import {
	DUPLICATE_STRATEGY_LABELS,
	REQUIRABLE_FIELD_LABELS,
} from './infrastructureSettingsLabels.ts';

interface FormProps {
	initial: InfrastructureSettings;
}

/**
 * Editable infrastructure-settings form. Initialised once from the loaded
 * server settings; local edits are held in `draft` until saved.
 */
function InfrastructureSettingsForm({ initial }: FormProps) {
	const updateMutation = useUpdateInfrastructureSettings();
	const [draft, setDraft] = useState<InfrastructureSettings>(initial);
	const pending = updateMutation.isPending;

	function toggleRequiredField(field: RequirableAssetField, checked: boolean) {
		setDraft((prev) => {
			const selected = new Set(prev.requiredAssetFields);
			if (checked) selected.add(field);
			else selected.delete(field);
			return {
				...prev,
				requiredAssetFields: REQUIRABLE_ASSET_FIELDS.filter((f) => selected.has(f)),
			};
		});
	}

	function setDashboardFilter<K extends keyof DashboardFilters>(
		key: K,
		value: DashboardFilters[K]
	) {
		setDraft((prev) => ({
			...prev,
			defaultDashboardFilters: { ...prev.defaultDashboardFilters, [key]: value },
		}));
	}

	function handleSave() {
		updateMutation.mutate(draft, {
			onError: () => toast.error('Failed to save infrastructure settings. Please try again.'),
			onSuccess: () => toast.success('Infrastructure settings saved'),
		});
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Required Asset Fields</CardTitle>
					<CardDescription>
						Fields an operator must fill when manually adding an asset. Name and asset
						type are always required.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{REQUIRABLE_ASSET_FIELDS.map((field) => (
							<label
								className="flex items-center gap-2 text-sm"
								htmlFor={`req-${field}`}
								key={field}>
								<Checkbox
									checked={draft.requiredAssetFields.includes(field)}
									disabled={pending}
									id={`req-${field}`}
									onCheckedChange={(checked) =>
										toggleRequiredField(field, checked === true)
									}
								/>
								{REQUIRABLE_FIELD_LABELS[field]}
							</label>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Stale-Data Threshold</CardTitle>
					<CardDescription>
						Assets not verified within this many days are flagged as stale on the
						dashboard. Applied when no explicit threshold is requested.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="max-w-xs space-y-2">
						<Label htmlFor="stale-threshold">Threshold (days)</Label>
						<Input
							disabled={pending}
							id="stale-threshold"
							max={MAX_STALE_THRESHOLD_DAYS}
							min={MIN_STALE_THRESHOLD_DAYS}
							onChange={(e) => {
								const next = Number(e.target.value);
								setDraft((prev) => ({
									...prev,
									staleThresholdDays: Number.isFinite(next)
										? next
										: prev.staleThresholdDays,
								}));
							}}
							type="number"
							value={draft.staleThresholdDays}
						/>
					</div>
				</CardContent>
			</Card>

			<InfrastructureDashboardFiltersCard
				draft={draft}
				pending={pending}
				setDashboardFilter={setDashboardFilter}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Import Behavior</CardTitle>
					<CardDescription>
						Policy for staged CSV imports that touch existing records.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<Label htmlFor="never-overwrite-notes">
								Never overwrite notes without review
							</Label>
							<p className="text-muted-foreground text-sm">
								Protect human-entered notes from being clobbered by imported data.
							</p>
						</div>
						<Switch
							checked={draft.importBehavior.neverOverwriteNotes}
							disabled={pending}
							id="never-overwrite-notes"
							onCheckedChange={(checked) =>
								setDraft((prev) => ({
									...prev,
									importBehavior: {
										...prev.importBehavior,
										neverOverwriteNotes: checked,
									},
								}))
							}
						/>
					</div>
					<div className="max-w-sm space-y-2">
						<Label>Duplicate row handling</Label>
						<Select
							disabled={pending}
							onValueChange={(value) =>
								setDraft((prev) => ({
									...prev,
									importBehavior: {
										...prev.importBehavior,
										duplicateStrategy:
											value as InfrastructureSettings['importBehavior']['duplicateStrategy'],
									},
								}))
							}
							value={draft.importBehavior.duplicateStrategy}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{IMPORT_DUPLICATE_STRATEGIES.map((strategy) => (
									<SelectItem key={strategy} value={strategy}>
										{DUPLICATE_STRATEGY_LABELS[strategy]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button disabled={pending} onClick={handleSave}>
					<Save aria-hidden="true" className="mr-2 size-4" />
					{pending ? 'Saving…' : 'Save Settings'}
				</Button>
			</div>
		</div>
	);
}

function InfrastructureTab() {
	const { data, isLoading } = useInfrastructureSettings();

	if (isLoading || !data) {
		return <p className="text-muted-foreground text-sm">Loading infrastructure settings…</p>;
	}

	// Remount the form when the server settings identity changes so the draft is
	// re-seeded from the latest values without a sync effect.
	return <InfrastructureSettingsForm initial={data} key={data.staleThresholdDays} />;
}

export { InfrastructureTab };

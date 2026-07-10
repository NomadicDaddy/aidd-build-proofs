import { ASSET_STATUSES, ASSET_TYPES, CRITICALITY_LEVELS } from 'spernakit-shared';

import type { InfrastructureSettings } from '@/api/infrastructureSettings';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { assetStatusLabel, assetTypeLabel, criticalityLabel } from '@/pages/assets/assetDisplay';

import type { DashboardFilters } from './infrastructureSettingsLabels.ts';

import { ANY } from './infrastructureSettingsLabels.ts';

interface InfrastructureDashboardFiltersCardProps {
	draft: InfrastructureSettings;
	pending: boolean;
	setDashboardFilter: <K extends keyof DashboardFilters>(
		key: K,
		value: DashboardFilters[K]
	) => void;
}

/** The "Default Dashboard Filters" settings card. */
export function InfrastructureDashboardFiltersCard({
	draft,
	pending,
	setDashboardFilter,
}: InfrastructureDashboardFiltersCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Default Dashboard Filters</CardTitle>
				<CardDescription>
					Filters applied by default when opening the asset inventory with no other
					filters selected.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-4">
					<div className="space-y-2">
						<Label>Status</Label>
						<Select
							disabled={pending}
							onValueChange={(value) =>
								setDashboardFilter(
									'status',
									value === ANY ? null : (value as DashboardFilters['status'])
								)
							}
							value={draft.defaultDashboardFilters.status ?? ANY}>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ANY}>Any status</SelectItem>
								{ASSET_STATUSES.map((status) => (
									<SelectItem key={status} value={status}>
										{assetStatusLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Type</Label>
						<Select
							disabled={pending}
							onValueChange={(value) =>
								setDashboardFilter(
									'assetType',
									value === ANY ? null : (value as DashboardFilters['assetType'])
								)
							}
							value={draft.defaultDashboardFilters.assetType ?? ANY}>
							<SelectTrigger className="w-[220px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ANY}>Any type</SelectItem>
								{ASSET_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{assetTypeLabel(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Criticality</Label>
						<Select
							disabled={pending}
							onValueChange={(value) =>
								setDashboardFilter(
									'criticality',
									value === ANY
										? null
										: (value as DashboardFilters['criticality'])
								)
							}
							value={draft.defaultDashboardFilters.criticality ?? ANY}>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ANY}>Any criticality</SelectItem>
								{CRITICALITY_LEVELS.map((level) => (
									<SelectItem key={level} value={level}>
										{criticalityLabel(level)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

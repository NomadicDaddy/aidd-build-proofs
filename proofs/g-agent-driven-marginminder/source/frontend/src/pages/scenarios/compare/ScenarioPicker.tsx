import { ListChecks } from 'lucide-react';

import type { ScenarioListItem } from '@/api/types';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatPercent } from '@/lib/pricingFormatters';
import { cn } from '@/lib/utils';

import { MAX_COMPARISON_SCENARIOS, STATUS_LABELS } from './types';

function EmptyComparisonState({ selectedCount }: { selectedCount: number }) {
	return (
		<Alert>
			<ListChecks aria-hidden="true" />
			<AlertTitle>Choose at least two scenarios</AlertTitle>
			<AlertDescription>
				{selectedCount === 0
					? 'Select saved scenarios from the list to build a comparison.'
					: 'Select one more saved scenario to build a comparison.'}
			</AlertDescription>
		</Alert>
	);
}

function ScenarioPicker({
	scenarios,
	selectedIds,
	toggleScenario,
}: {
	scenarios: ScenarioListItem[];
	selectedIds: number[];
	toggleScenario: (scenarioId: number, selected: boolean) => void;
}) {
	if (scenarios.length === 0) {
		return (
			<div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
				No saved scenarios are available yet.
			</div>
		);
	}

	return (
		<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
			{scenarios.map((scenario) => {
				const isSelected = selectedIds.includes(scenario.id);
				const isDisabled = !isSelected && selectedIds.length >= MAX_COMPARISON_SCENARIOS;

				return (
					<label
						className={cn(
							'hover:bg-accent/60 flex cursor-pointer gap-3 rounded-md border p-3 transition-colors',
							isSelected && 'border-primary bg-primary/5',
							isDisabled && 'cursor-not-allowed opacity-55'
						)}
						key={scenario.id}>
						<Checkbox
							aria-label={`Select ${scenario.title}`}
							checked={isSelected}
							disabled={isDisabled}
							onCheckedChange={(checked) =>
								toggleScenario(scenario.id, checked === true)
							}
						/>
						<span className="min-w-0 flex-1 space-y-2">
							<span className="block min-w-0">
								<span className="block truncate font-medium">{scenario.title}</span>
								<span className="text-muted-foreground block truncate text-xs">
									{scenario.customerName}
								</span>
							</span>
							<span className="flex flex-wrap items-center gap-2 text-xs">
								<Badge variant="secondary">{STATUS_LABELS[scenario.status]}</Badge>
								<span className="text-muted-foreground">
									{formatCurrency(scenario.finalPrice)}
								</span>
								<span className="text-muted-foreground">
									{formatPercent(scenario.marginPercent, 'Not priced')}
								</span>
							</span>
						</span>
					</label>
				);
			})}
		</div>
	);
}

function SelectedScenarioStrip({ scenarios }: { scenarios: ScenarioListItem[] }) {
	if (scenarios.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2">
			{scenarios.map((scenario) => (
				<Badge className="px-3 py-1" key={scenario.id} variant="secondary">
					{scenario.customerName} / {scenario.title}
				</Badge>
			))}
		</div>
	);
}

export { EmptyComparisonState, ScenarioPicker, SelectedScenarioStrip };

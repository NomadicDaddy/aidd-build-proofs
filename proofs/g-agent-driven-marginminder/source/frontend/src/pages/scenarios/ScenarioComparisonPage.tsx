import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { compareScenarios, listScenarios } from '@/api/scenarios';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
	ComparisonTable,
	EmptyComparisonState,
	MAX_COMPARISON_SCENARIOS,
	ScenarioPicker,
	SelectedScenarioStrip,
} from './compare';

function ScenarioComparisonPage() {
	const [selectedIds, setSelectedIds] = useState<number[]>([]);

	const { data: listData, isLoading: isLoadingScenarios } = useQuery({
		queryFn: () => listScenarios({ includeArchived: true, limit: 100 }),
		queryKey: ['scenarios', 'comparison-picker'],
	});
	const scenarios = listData?.data.data ?? [];
	const selectedScenarios = scenarios.filter((scenario) => selectedIds.includes(scenario.id));
	const canCompare = selectedIds.length >= 2;
	const { data: comparisonData, isFetching: isComparing } = useQuery({
		enabled: canCompare,
		queryFn: () => compareScenarios(selectedIds),
		queryKey: ['scenario-comparison', selectedIds],
	});
	const comparisonScenarios = comparisonData?.data.scenarios ?? [];

	function toggleScenario(scenarioId: number, selected: boolean) {
		setSelectedIds((current) => {
			if (selected) {
				if (current.includes(scenarioId)) return current;
				return [...current, scenarioId].slice(0, MAX_COMPARISON_SCENARIOS);
			}

			return current.filter((id) => id !== scenarioId);
		});
	}

	function clearSelection() {
		setSelectedIds([]);
	}

	return (
		<div className="space-y-5 p-6">
			<PageHeader
				description="Select saved quote scenarios and compare pricing outcomes side by side."
				icon={GitCompareArrows}
				title="Compare Scenarios">
				<Button asChild variant="outline">
					<Link to="/scenarios">View Scenarios</Link>
				</Button>
				<Button
					disabled={selectedIds.length === 0}
					onClick={clearSelection}
					type="button"
					variant="outline">
					<RotateCcw aria-hidden="true" className="size-4" />
					Clear
				</Button>
			</PageHeader>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-3">
						<span>Select scenarios</span>
						<span className="text-muted-foreground text-sm font-normal">
							{selectedIds.length}/{MAX_COMPARISON_SCENARIOS} selected
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<ScenarioPicker
						scenarios={scenarios}
						selectedIds={selectedIds}
						toggleScenario={toggleScenario}
					/>
					{isLoadingScenarios && (
						<div className="text-muted-foreground text-sm">Loading scenarios...</div>
					)}
				</CardContent>
			</Card>

			<div className="space-y-3">
				<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<SelectedScenarioStrip scenarios={selectedScenarios} />
					{isComparing && (
						<div className="text-muted-foreground text-sm">
							Refreshing comparison...
						</div>
					)}
				</div>

				{!canCompare && <EmptyComparisonState selectedCount={selectedIds.length} />}

				{canCompare && comparisonScenarios.length > 0 && (
					<ComparisonTable scenarios={comparisonScenarios} />
				)}

				{canCompare && comparisonScenarios.length === 0 && !isComparing && (
					<Alert>
						<TriangleAlert aria-hidden="true" />
						<AlertTitle>Comparison unavailable</AlertTitle>
						<AlertDescription>
							One or more selected scenarios could not be loaded.
						</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	);
}

export { ScenarioComparisonPage };

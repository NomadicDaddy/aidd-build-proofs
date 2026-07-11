import type { ScenarioComparisonItem, ScenarioListItem, ScenarioRiskFlag } from '@/api/types';

export interface ComparisonMetric {
	getClassName?: (scenario: ScenarioComparisonItem) => string;
	label: string;
	renderValue: (scenario: ScenarioComparisonItem) => string;
}

export const MAX_COMPARISON_SCENARIOS = 10;

export const STATUS_LABELS: Record<ScenarioListItem['status'], string> = {
	approved: 'Approved',
	archived: 'Archived',
	draft: 'Draft',
	review: 'Review',
};

export const RISK_LABELS: Record<ScenarioRiskFlag['code'], string> = {
	below_target_margin: 'Below target',
	high_discount: 'High discount',
	missing_contingency: 'No contingency',
	stale_catalog_assumption: 'Stale catalog',
};

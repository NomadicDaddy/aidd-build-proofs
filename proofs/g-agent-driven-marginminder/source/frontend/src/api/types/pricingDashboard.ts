import type { ScenarioListItem } from './scenarios.ts';

interface PricingDashboardData {
	averageMarginPercent: null | number;
	belowTargetCount: number;
	draftCount: number;
	recentScenarios: ScenarioListItem[];
	totalScenarios: number;
}

export type { PricingDashboardData };

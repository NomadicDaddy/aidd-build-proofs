import { and, count, desc, eq, ne, type SQL } from 'drizzle-orm';

import type { ScenarioListItem, ScenarioRiskFlag, ScenarioStatus } from './scenarioTypes.ts';

import { getDb } from '../../db/index.ts';
import { quoteScenarios } from '../../db/schema/quoteScenarios.ts';
import { getScenarioDetail } from './scenarioCrud.ts';

/**
 * Maximum number of active scenarios loaded with full detail for dashboard
 * margin calculations and risk-flag counting. Prevents unbounded queries as
 * the scenario table grows.
 */
const DASHBOARD_DETAIL_LIMIT = 100;

/** Number of most-recent scenarios returned for the dashboard card list. */
const RECENT_SCENARIOS_LIMIT = 5;

interface PricingDashboardData {
	averageMarginPercent: null | number;
	belowTargetCount: number;
	draftCount: number;
	recentScenarios: ScenarioListItem[];
	totalScenarios: number;
}

function hasBelowTargetRisk(flags: ScenarioRiskFlag[]): boolean {
	return flags.some((flag) => flag.code === 'below_target_margin');
}

type LoadedScenarioDetail = NonNullable<ReturnType<typeof getScenarioDetail>>;

function toScenarioListItem(detail: LoadedScenarioDetail): ScenarioListItem {
	return {
		customerName: detail.scenario.customerName,
		finalPrice: detail.summary.finalPrice,
		id: detail.scenario.id,
		marginPercent: detail.summary.marginPercent,
		riskCount: detail.summary.riskFlags.length,
		riskFlags: detail.summary.riskFlags,
		status: detail.scenario.status as ScenarioStatus,
		targetMarginPercent: detail.scenario.targetMarginPercent,
		title: detail.scenario.title,
		updatedAt: detail.scenario.updatedAt,
	};
}

function averageMargin(scenarios: ScenarioListItem[]): null | number {
	const margins = scenarios
		.map((scenario) => scenario.marginPercent)
		.filter((margin): margin is number => margin !== null);

	if (margins.length === 0) return null;

	return margins.reduce((total, margin) => total + margin, 0) / margins.length;
}

function getAggregateCount(whereCondition: SQL | undefined): number {
	const row = getDb().select({ value: count() }).from(quoteScenarios).where(whereCondition).get();

	return row?.value ?? 0;
}

function getPricingDashboard(): PricingDashboardData {
	const activeFilter = ne(quoteScenarios.status, 'archived');

	// Aggregate COUNT queries avoid loading any scenario detail rows.
	const totalScenarios = getAggregateCount(activeFilter);
	const draftCount = getAggregateCount(and(eq(quoteScenarios.status, 'draft'), activeFilter));

	// Load a bounded set of the most recent active scenarios with full detail
	// for margin averaging, risk-flag counting, and the recent-scenarios card.
	const recentRows = getDb()
		.select({ id: quoteScenarios.id })
		.from(quoteScenarios)
		.where(activeFilter)
		.orderBy(desc(quoteScenarios.updatedAt), desc(quoteScenarios.id))
		.limit(DASHBOARD_DETAIL_LIMIT)
		.all();

	const detailedScenarios = recentRows
		.map((row) => getScenarioDetail(row.id))
		.filter((detail): detail is LoadedScenarioDetail => detail !== null)
		.map(toScenarioListItem);

	return {
		averageMarginPercent: averageMargin(detailedScenarios),
		belowTargetCount: detailedScenarios.filter((scenario) =>
			hasBelowTargetRisk(scenario.riskFlags)
		).length,
		draftCount,
		recentScenarios: detailedScenarios.slice(0, RECENT_SCENARIOS_LIMIT),
		totalScenarios,
	};
}

export { getPricingDashboard };
export type { PricingDashboardData };

import type {
	CostCatalogAssumptionRow,
	QuoteScenarioRow,
	ScenarioFixedCostRow,
	ScenarioLaborEntryRow,
	ScenarioLineItemRow,
	ScenarioRiskFlag,
	ScenarioSummary,
} from './scenarioTypes.ts';

import { calculatePricingSummary } from '../pricingCalculationService.ts';

const STALE_CATALOG_DAYS = 90;

function getUtcDayTime(value: Date): number {
	return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function getStaleCatalogCutoffUtcDay(requestTime: Date): number {
	const cutoff = new Date(getUtcDayTime(requestTime));
	cutoff.setUTCDate(cutoff.getUTCDate() - STALE_CATALOG_DAYS);

	return cutoff.getTime();
}

function hasStaleCatalogAssumption(
	lineItems: ScenarioLineItemRow[],
	catalogAssumptions: CostCatalogAssumptionRow[],
	requestTime: Date
): boolean {
	const referencedCatalogIds = new Set(
		lineItems
			.map((item) => item.catalogItemId)
			.filter((catalogItemId): catalogItemId is number => catalogItemId !== null)
	);
	if (referencedCatalogIds.size === 0) return false;

	const cutoffUtcDay = getStaleCatalogCutoffUtcDay(requestTime);

	return catalogAssumptions.some((assumption) => {
		if (!referencedCatalogIds.has(assumption.id)) return false;
		if (assumption.lastReviewedAt === null) return true;

		return getUtcDayTime(assumption.lastReviewedAt) < cutoffUtcDay;
	});
}

function getRiskFlags(
	scenario: QuoteScenarioRow,
	marginPercent: null | number,
	lineItems: ScenarioLineItemRow[],
	catalogAssumptions: CostCatalogAssumptionRow[],
	requestTime: Date
): ScenarioRiskFlag[] {
	const flags: ScenarioRiskFlag[] = [];

	if (marginPercent !== null && marginPercent < scenario.targetMarginPercent) {
		flags.push({
			code: 'below_target_margin',
			level: 'warning',
			message: 'Gross margin is below the target margin.',
		});
	}

	if (scenario.discountPercent > 15) {
		flags.push({
			code: 'high_discount',
			level: 'warning',
			message: 'Discount is above 15 percent.',
		});
	}

	if (scenario.contingencyPercent === 0) {
		flags.push({
			code: 'missing_contingency',
			level: 'warning',
			message: 'No contingency is included.',
		});
	}

	if (hasStaleCatalogAssumption(lineItems, catalogAssumptions, requestTime)) {
		flags.push({
			code: 'stale_catalog_assumption',
			level: 'warning',
			message: 'One or more linked catalog assumptions are stale or unreviewed.',
		});
	}

	return flags;
}

function calculateScenarioSummary(
	scenario: QuoteScenarioRow,
	lineItems: ScenarioLineItemRow[],
	laborEntries: ScenarioLaborEntryRow[],
	fixedCosts: ScenarioFixedCostRow[],
	catalogAssumptions: CostCatalogAssumptionRow[] = [],
	requestTime = new Date()
): ScenarioSummary {
	const summary = calculatePricingSummary(scenario, lineItems, laborEntries, fixedCosts);

	return {
		...summary,
		riskFlags: getRiskFlags(
			scenario,
			summary.marginPercent,
			lineItems,
			catalogAssumptions,
			requestTime
		),
	};
}

export { calculateScenarioSummary };

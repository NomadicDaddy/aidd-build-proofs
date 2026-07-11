import type { costCatalogItems } from '../../db/schema/costCatalogItems.ts';
import type { quoteScenarios } from '../../db/schema/quoteScenarios.ts';
import type { scenarioFixedCosts } from '../../db/schema/scenarioFixedCosts.ts';
import type { scenarioLaborEntries } from '../../db/schema/scenarioLaborEntries.ts';
import type { scenarioLineItems } from '../../db/schema/scenarioLineItems.ts';

type CostCatalogAssumptionRow = Pick<typeof costCatalogItems.$inferSelect, 'id' | 'lastReviewedAt'>;
type ScenarioStatus = 'approved' | 'archived' | 'draft' | 'review';

type QuoteScenarioRow = typeof quoteScenarios.$inferSelect;
type ScenarioFixedCostRow = typeof scenarioFixedCosts.$inferSelect;
type ScenarioLaborEntryRow = typeof scenarioLaborEntries.$inferSelect;
type ScenarioLineItemRow = typeof scenarioLineItems.$inferSelect;

interface ScenarioInput {
	assumptions?: null | string;
	contingencyPercent?: number;
	customerName: string;
	discountPercent?: number;
	fixedCosts?: ScenarioFixedCostInput[];
	laborEntries?: ScenarioLaborEntryInput[];
	lineItems?: ScenarioLineItemInput[];
	notes?: null | string;
	status?: ScenarioStatus;
	targetMarginPercent?: number;
	taxRatePercent?: number;
	title: string;
}

interface ScenarioUpdateInput {
	assumptions?: null | string;
	contingencyPercent?: number;
	customerName?: string;
	discountPercent?: number;
	fixedCosts?: ScenarioFixedCostInput[];
	laborEntries?: ScenarioLaborEntryInput[];
	lineItems?: ScenarioLineItemInput[];
	notes?: null | string;
	status?: ScenarioStatus;
	targetMarginPercent?: number;
	taxRatePercent?: number;
	title?: string;
}

interface ScenarioLineItemInput {
	catalogItemId?: null | number;
	category: 'fee' | 'labor' | 'material' | 'other' | 'overhead' | 'subcontractor';
	markupPercent?: number;
	name: string;
	notes?: null | string;
	quantity?: number;
	sortOrder?: number;
	taxable?: boolean;
	unit: string;
	unitCost?: number;
}

interface ScenarioLaborEntryInput {
	billableHourlyRate?: number;
	burdenPercent?: number;
	hours?: number;
	internalHourlyCost?: number;
	notes?: null | string;
	roleName: string;
	sortOrder?: number;
}

interface ScenarioFixedCostInput {
	cost?: number;
	markupPercent?: number;
	name: string;
	notes?: null | string;
	sortOrder?: number;
	taxable?: boolean;
}

interface ScenarioListOptions {
	includeArchived: boolean;
	limit: number;
	page: number;
	search?: string;
	status?: ScenarioStatus;
}

interface ScenarioDetail {
	fixedCosts: ScenarioFixedCostRow[];
	laborEntries: ScenarioLaborEntryRow[];
	lineItems: ScenarioLineItemRow[];
	scenario: QuoteScenarioRow;
	summary: ScenarioSummary;
}

interface ScenarioListItem {
	customerName: string;
	finalPrice: number;
	id: number;
	marginPercent: null | number;
	riskCount: number;
	riskFlags: ScenarioRiskFlag[];
	status: ScenarioStatus;
	targetMarginPercent: number;
	title: string;
	updatedAt: Date;
}

interface ScenarioListResult {
	data: ScenarioListItem[];
	limit: number;
	page: number;
	total: number;
}

interface ScenarioRiskFlag {
	code:
		| 'below_target_margin'
		| 'high_discount'
		| 'missing_contingency'
		| 'stale_catalog_assumption';
	level: 'warning';
	message: string;
}

interface ScenarioSummary {
	breakEvenPriceBeforeTax: number;
	contingencyAmount: number;
	directCost: number;
	discountAmount: number;
	finalPrice: number;
	fixedCostSellPrice: number;
	grossProfit: number;
	laborSellPrice: number;
	lineItemSellPrice: number;
	marginPercent: null | number;
	markupPercent: null | number;
	riskFlags: ScenarioRiskFlag[];
	subtotalBeforeDiscount: number;
	targetMarginGap: null | number;
	targetPriceBeforeTax: number;
	taxableSubtotal: number;
	taxAmount: number;
}

interface ScenarioComparisonResult {
	scenarios: {
		customerName: string;
		id: number;
		status: ScenarioStatus;
		summary: ScenarioSummary;
		title: string;
		updatedAt: Date;
	}[];
}

export type {
	CostCatalogAssumptionRow,
	QuoteScenarioRow,
	ScenarioComparisonResult,
	ScenarioDetail,
	ScenarioFixedCostInput,
	ScenarioFixedCostRow,
	ScenarioLaborEntryInput,
	ScenarioInput,
	ScenarioLineItemInput,
	ScenarioLaborEntryRow,
	ScenarioLineItemRow,
	ScenarioListItem,
	ScenarioListOptions,
	ScenarioListResult,
	ScenarioRiskFlag,
	ScenarioStatus,
	ScenarioSummary,
	ScenarioUpdateInput,
};

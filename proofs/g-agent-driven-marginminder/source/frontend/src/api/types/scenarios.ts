type ScenarioStatus = 'approved' | 'archived' | 'draft' | 'review';
type ScenarioLineItemCategory =
	| 'fee'
	| 'labor'
	| 'material'
	| 'other'
	| 'overhead'
	| 'subcontractor';

type ScenarioRiskCode =
	| 'below_target_margin'
	| 'high_discount'
	| 'missing_contingency'
	| 'stale_catalog_assumption';

interface ScenarioRiskFlag {
	code: ScenarioRiskCode;
	level: 'warning';
	message: string;
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
	updatedAt: string;
}

interface ScenarioListResult {
	data: ScenarioListItem[];
	limit: number;
	page: number;
	total: number;
}

interface QuoteScenario {
	assumptions: null | string;
	contingencyPercent: number;
	createdAt: string;
	customerName: string;
	discountPercent: number;
	id: number;
	notes: null | string;
	status: ScenarioStatus;
	targetMarginPercent: number;
	taxRatePercent: number;
	title: string;
	updatedAt: string;
}

interface ScenarioLineItem {
	catalogItemId: null | number;
	category: ScenarioLineItemCategory;
	createdAt: string;
	id: number;
	markupPercent: number;
	name: string;
	notes: null | string;
	quantity: number;
	scenarioId: number;
	sortOrder: number;
	taxable: boolean;
	unit: string;
	unitCost: number;
	updatedAt: string;
}

interface ScenarioLaborEntry {
	billableHourlyRate: number;
	burdenPercent: number;
	createdAt: string;
	hours: number;
	id: number;
	internalHourlyCost: number;
	notes: null | string;
	roleName: string;
	scenarioId: number;
	sortOrder: number;
	updatedAt: string;
}

interface ScenarioFixedCost {
	cost: number;
	createdAt: string;
	id: number;
	markupPercent: number;
	name: string;
	notes: null | string;
	scenarioId: number;
	sortOrder: number;
	taxable: boolean;
	updatedAt: string;
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

interface ScenarioDetail {
	fixedCosts: ScenarioFixedCost[];
	laborEntries: ScenarioLaborEntry[];
	lineItems: ScenarioLineItem[];
	scenario: QuoteScenario;
	summary: ScenarioSummary;
}

interface ScenarioComparisonItem {
	customerName: string;
	id: number;
	status: ScenarioStatus;
	summary: ScenarioSummary;
	title: string;
	updatedAt: string;
}

interface ScenarioComparisonResult {
	scenarios: ScenarioComparisonItem[];
}

interface ScenarioLineItemInput {
	catalogItemId?: null | number;
	category: ScenarioLineItemCategory;
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

type ScenarioUpdateInput = Partial<ScenarioInput>;

export type {
	QuoteScenario,
	ScenarioComparisonItem,
	ScenarioComparisonResult,
	ScenarioDetail,
	ScenarioFixedCost,
	ScenarioFixedCostInput,
	ScenarioInput,
	ScenarioLaborEntry,
	ScenarioLaborEntryInput,
	ScenarioLineItem,
	ScenarioLineItemCategory,
	ScenarioLineItemInput,
	ScenarioListItem,
	ScenarioListResult,
	ScenarioRiskFlag,
	ScenarioStatus,
	ScenarioSummary,
	ScenarioUpdateInput,
};

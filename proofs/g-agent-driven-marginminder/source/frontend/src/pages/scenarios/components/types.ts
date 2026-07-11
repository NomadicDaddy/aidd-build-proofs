import type {
	ScenarioLineItemCategory,
	ScenarioRiskFlag,
	ScenarioStatus,
	ScenarioSummary,
} from '@/api/types';

export type ErrorMap = Record<string, string>;

export interface LineItemDraft {
	catalogItemId: null | number;
	category: ScenarioLineItemCategory;
	localId: string;
	markupPercent: string;
	name: string;
	notes: string;
	quantity: string;
	taxable: boolean;
	unit: string;
	unitCost: string;
}

export interface LaborEntryDraft {
	billableHourlyRate: string;
	burdenPercent: string;
	hours: string;
	internalHourlyCost: string;
	localId: string;
	notes: string;
	roleName: string;
}

export interface FixedCostDraft {
	cost: string;
	localId: string;
	markupPercent: string;
	name: string;
	notes: string;
	taxable: boolean;
}

export interface ScenarioFormState {
	assumptions: string;
	contingencyPercent: string;
	customerName: string;
	discountPercent: string;
	fixedCosts: FixedCostDraft[];
	laborEntries: LaborEntryDraft[];
	lineItems: LineItemDraft[];
	notes: string;
	status: ScenarioStatus;
	targetMarginPercent: string;
	taxRatePercent: string;
	title: string;
}

export type ScenarioNumericFieldKey =
	| 'contingencyPercent'
	| 'discountPercent'
	| 'targetMarginPercent'
	| 'taxRatePercent';

export type LaborNumberFieldKey =
	| 'billableHourlyRate'
	| 'burdenPercent'
	| 'hours'
	| 'internalHourlyCost';

export const SCENARIO_EDITOR_TAB_VALUES = [
	'line-items',
	'labor',
	'fixed-costs',
	'summary',
	'export',
] as const;

export type ScenarioEditorTabKey = (typeof SCENARIO_EDITOR_TAB_VALUES)[number];

export interface CopyFeedback {
	message: string;
	type: 'error' | 'success';
}

export const CATEGORY_LABELS: Record<ScenarioLineItemCategory, string> = {
	fee: 'Fee',
	labor: 'Labor',
	material: 'Material',
	other: 'Other',
	overhead: 'Overhead',
	subcontractor: 'Subcontractor',
};

export const RISK_LABELS: Record<ScenarioRiskFlag['code'], string> = {
	below_target_margin: 'Below target',
	high_discount: 'High discount',
	missing_contingency: 'No contingency',
	stale_catalog_assumption: 'Stale catalog',
};

export const STATUS_LABELS: Record<ScenarioStatus, string> = {
	approved: 'Approved',
	archived: 'Archived',
	draft: 'Draft',
	review: 'Review',
};

export const ZERO_SUMMARY: ScenarioSummary = {
	breakEvenPriceBeforeTax: 0,
	contingencyAmount: 0,
	directCost: 0,
	discountAmount: 0,
	finalPrice: 0,
	fixedCostSellPrice: 0,
	grossProfit: 0,
	laborSellPrice: 0,
	lineItemSellPrice: 0,
	marginPercent: null,
	markupPercent: null,
	riskFlags: [],
	subtotalBeforeDiscount: 0,
	targetMarginGap: null,
	targetPriceBeforeTax: 0,
	taxableSubtotal: 0,
	taxAmount: 0,
};

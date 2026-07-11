import type {
	CostCatalogItem,
	ScenarioDetail,
	ScenarioFixedCostInput,
	ScenarioInput,
	ScenarioLaborEntryInput,
	ScenarioLineItemInput,
} from '@/api/types';

import { formatCurrency, formatPercent } from '@/lib/pricingFormatters';

import type {
	ErrorMap,
	FixedCostDraft,
	LaborEntryDraft,
	LineItemDraft,
	ScenarioEditorTabKey,
	ScenarioFormState,
} from './types';

import { CATEGORY_LABELS, RISK_LABELS, SCENARIO_EDITOR_TAB_VALUES, STATUS_LABELS } from './types';

const CUSTOM_CATALOG_VALUE = 'custom';

let draftIdSequence = 0;

function getDraftId(prefix: string): string {
	draftIdSequence += 1;
	return `${prefix}-${draftIdSequence}`;
}

export { CUSTOM_CATALOG_VALUE, getDraftId };

export function blankLineItem(): LineItemDraft {
	return {
		catalogItemId: null,
		category: 'material',
		localId: getDraftId('line'),
		markupPercent: '0',
		name: '',
		notes: '',
		quantity: '1',
		taxable: true,
		unit: 'each',
		unitCost: '0',
	};
}

export function blankLaborEntry(): LaborEntryDraft {
	return {
		billableHourlyRate: '0',
		burdenPercent: '0',
		hours: '0',
		internalHourlyCost: '0',
		localId: getDraftId('labor'),
		notes: '',
		roleName: '',
	};
}

export function blankFixedCost(): FixedCostDraft {
	return {
		cost: '0',
		localId: getDraftId('fixed'),
		markupPercent: '0',
		name: '',
		notes: '',
		taxable: false,
	};
}

export function getInitialFormState(): ScenarioFormState {
	return {
		assumptions: '',
		contingencyPercent: '0',
		customerName: '',
		discountPercent: '0',
		fixedCosts: [],
		laborEntries: [],
		lineItems: [],
		notes: '',
		status: 'draft',
		targetMarginPercent: '30',
		taxRatePercent: '0',
		title: '',
	};
}

export function formatNumberInput(value: number): string {
	return Number.isInteger(value) ? String(value) : String(value);
}

export function formStateFromDetail(detail: ScenarioDetail): ScenarioFormState {
	return {
		assumptions: detail.scenario.assumptions ?? '',
		contingencyPercent: formatNumberInput(detail.scenario.contingencyPercent),
		customerName: detail.scenario.customerName,
		discountPercent: formatNumberInput(detail.scenario.discountPercent),
		fixedCosts: detail.fixedCosts.map((cost) => ({
			cost: formatNumberInput(cost.cost),
			localId: getDraftId('fixed'),
			markupPercent: formatNumberInput(cost.markupPercent),
			name: cost.name,
			notes: cost.notes ?? '',
			taxable: cost.taxable,
		})),
		laborEntries: detail.laborEntries.map((entry) => ({
			billableHourlyRate: formatNumberInput(entry.billableHourlyRate),
			burdenPercent: formatNumberInput(entry.burdenPercent),
			hours: formatNumberInput(entry.hours),
			internalHourlyCost: formatNumberInput(entry.internalHourlyCost),
			localId: getDraftId('labor'),
			notes: entry.notes ?? '',
			roleName: entry.roleName,
		})),
		lineItems: detail.lineItems.map((item) => ({
			catalogItemId: item.catalogItemId,
			category: item.category,
			localId: getDraftId('line'),
			markupPercent: formatNumberInput(item.markupPercent),
			name: item.name,
			notes: item.notes ?? '',
			quantity: formatNumberInput(item.quantity),
			taxable: item.taxable,
			unit: item.unit,
			unitCost: formatNumberInput(item.unitCost),
		})),
		notes: detail.scenario.notes ?? '',
		status: detail.scenario.status,
		targetMarginPercent: formatNumberInput(detail.scenario.targetMarginPercent),
		taxRatePercent: formatNumberInput(detail.scenario.taxRatePercent),
		title: detail.scenario.title,
	};
}

export function parseNonNegativeNumber(value: string): null | number {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return parsed;
}

export function nullableText(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function requireText(errors: ErrorMap, key: string, value: string, label: string): void {
	if (value.trim().length === 0) {
		errors[key] = `${label} is required.`;
	}
}

export function getNumberValidationError(
	value: string,
	label: string,
	maximum?: number
): null | string {
	const parsed = parseNonNegativeNumber(value);
	if (parsed === null) return `${label} must be zero or greater.`;
	if (maximum !== undefined && parsed > maximum) return `${label} must be ${maximum} or less.`;
	return null;
}

export function requireNumber(
	errors: ErrorMap,
	key: string,
	value: string,
	label: string,
	maximum?: number
): number {
	const error = getNumberValidationError(value, label, maximum);
	if (error !== null) {
		errors[key] = error;
		return parseNonNegativeNumber(value) ?? 0;
	}
	return parseNonNegativeNumber(value) ?? 0;
}

export function buildPayload(form: ScenarioFormState): {
	errors: ErrorMap;
	payload: ScenarioInput;
} {
	const errors: ErrorMap = {};
	requireText(errors, 'customerName', form.customerName, 'Customer name');
	requireText(errors, 'title', form.title, 'Scenario title');

	const targetMarginPercent = requireNumber(
		errors,
		'targetMarginPercent',
		form.targetMarginPercent,
		'Target margin',
		99.99
	);
	const taxRatePercent = requireNumber(errors, 'taxRatePercent', form.taxRatePercent, 'Tax rate');
	const contingencyPercent = requireNumber(
		errors,
		'contingencyPercent',
		form.contingencyPercent,
		'Contingency'
	);
	const discountPercent = requireNumber(
		errors,
		'discountPercent',
		form.discountPercent,
		'Discount',
		100
	);

	const lineItems: ScenarioLineItemInput[] = form.lineItems.map((item, index) => {
		requireText(errors, `lineItems.${index}.name`, item.name, 'Line item name');
		requireText(errors, `lineItems.${index}.unit`, item.unit, 'Unit');

		return {
			catalogItemId: item.catalogItemId,
			category: item.category,
			markupPercent: requireNumber(
				errors,
				`lineItems.${index}.markupPercent`,
				item.markupPercent,
				'Markup'
			),
			name: item.name.trim(),
			notes: nullableText(item.notes),
			quantity: requireNumber(
				errors,
				`lineItems.${index}.quantity`,
				item.quantity,
				'Quantity'
			),
			sortOrder: index,
			taxable: item.taxable,
			unit: item.unit.trim(),
			unitCost: requireNumber(
				errors,
				`lineItems.${index}.unitCost`,
				item.unitCost,
				'Unit cost'
			),
		};
	});

	const laborEntries: ScenarioLaborEntryInput[] = form.laborEntries.map((entry, index) => {
		requireText(errors, `laborEntries.${index}.roleName`, entry.roleName, 'Labor role');

		return {
			billableHourlyRate: requireNumber(
				errors,
				`laborEntries.${index}.billableHourlyRate`,
				entry.billableHourlyRate,
				'Billable rate'
			),
			burdenPercent: requireNumber(
				errors,
				`laborEntries.${index}.burdenPercent`,
				entry.burdenPercent,
				'Burden'
			),
			hours: requireNumber(errors, `laborEntries.${index}.hours`, entry.hours, 'Hours'),
			internalHourlyCost: requireNumber(
				errors,
				`laborEntries.${index}.internalHourlyCost`,
				entry.internalHourlyCost,
				'Internal cost'
			),
			notes: nullableText(entry.notes),
			roleName: entry.roleName.trim(),
			sortOrder: index,
		};
	});

	const fixedCosts: ScenarioFixedCostInput[] = form.fixedCosts.map((cost, index) => {
		requireText(errors, `fixedCosts.${index}.name`, cost.name, 'Fixed cost name');

		return {
			cost: requireNumber(errors, `fixedCosts.${index}.cost`, cost.cost, 'Cost'),
			markupPercent: requireNumber(
				errors,
				`fixedCosts.${index}.markupPercent`,
				cost.markupPercent,
				'Markup'
			),
			name: cost.name.trim(),
			notes: nullableText(cost.notes),
			sortOrder: index,
			taxable: cost.taxable,
		};
	});

	return {
		errors,
		payload: {
			assumptions: nullableText(form.assumptions),
			contingencyPercent,
			customerName: form.customerName.trim(),
			discountPercent,
			fixedCosts,
			laborEntries,
			lineItems,
			notes: nullableText(form.notes),
			status: form.status,
			targetMarginPercent,
			taxRatePercent,
			title: form.title.trim(),
		},
	};
}

export function getCatalogSelectValue(catalogItemId: null | number): string {
	return catalogItemId === null ? CUSTOM_CATALOG_VALUE : String(catalogItemId);
}

export function getCatalogItemLabel(item: CostCatalogItem): string {
	return `${item.name} (${CATEGORY_LABELS[item.category]})`;
}

export function isScenarioEditorTabKey(value: string): value is ScenarioEditorTabKey {
	return SCENARIO_EDITOR_TAB_VALUES.some((tabValue) => tabValue === value);
}

export function formatMarkdownList(value: null | string, emptyLabel: string): string {
	const lines =
		value
			?.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0) ?? [];

	if (lines.length === 0) return `- ${emptyLabel}`;

	return lines.map((line) => (line.startsWith('- ') ? line : `- ${line}`)).join('\n');
}

export function buildExportText(detail: null | ScenarioDetail): string {
	if (!detail) return '';

	const { scenario, summary } = detail;
	const riskText =
		summary.riskFlags.length > 0
			? summary.riskFlags
					.map((flag) => `- ${RISK_LABELS[flag.code]}: ${flag.message}`)
					.join('\n')
			: '- None';

	return [
		`# ${scenario.customerName} - ${scenario.title}`,
		'',
		`- Status: ${STATUS_LABELS[scenario.status]}`,
		`- Final price: ${formatCurrency(summary.finalPrice)}`,
		`- Direct cost: ${formatCurrency(summary.directCost)}`,
		`- Gross profit: ${formatCurrency(summary.grossProfit)}`,
		`- Margin: ${formatPercent(summary.marginPercent)}`,
		`- Target margin: ${formatPercent(scenario.targetMarginPercent)}`,
		`- Discount: ${formatPercent(scenario.discountPercent)}`,
		`- Contingency: ${formatPercent(scenario.contingencyPercent)}`,
		'',
		'## Major assumptions',
		formatMarkdownList(scenario.assumptions, 'No assumptions recorded.'),
		'',
		'## Risks',
		riskText,
	].join('\n');
}

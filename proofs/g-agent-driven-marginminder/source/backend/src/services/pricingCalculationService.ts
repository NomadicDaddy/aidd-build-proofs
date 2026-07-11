interface PricingFixedCostInput {
	cost: number;
	markupPercent: number;
	taxable: boolean;
}

interface PricingLaborEntryInput {
	billableHourlyRate: number;
	burdenPercent: number;
	hours: number;
	internalHourlyCost: number;
}

interface PricingLineItemInput {
	markupPercent: number;
	quantity: number;
	taxable: boolean;
	unitCost: number;
}

interface PricingScenarioInput {
	contingencyPercent: number;
	discountPercent: number;
	targetMarginPercent: number;
	taxRatePercent: number;
}

interface PricingSummary {
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
	subtotalBeforeDiscount: number;
	targetMarginGap: null | number;
	targetPriceBeforeTax: number;
	taxableSubtotal: number;
	taxAmount: number;
}

function roundMoney(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
	return Math.round((value + Number.EPSILON) * 10) / 10;
}

function calculateLineItemDirectCost(item: PricingLineItemInput): number {
	return item.quantity * item.unitCost;
}

function calculateLineItemSellPrice(item: PricingLineItemInput): number {
	return calculateLineItemDirectCost(item) * (1 + item.markupPercent / 100);
}

function calculateFixedCostSellPrice(cost: PricingFixedCostInput): number {
	return cost.cost * (1 + cost.markupPercent / 100);
}

function calculateLaborInternalCost(entry: PricingLaborEntryInput): number {
	return entry.hours * entry.internalHourlyCost * (1 + entry.burdenPercent / 100);
}

function calculateLaborSellPrice(entry: PricingLaborEntryInput): number {
	return entry.hours * entry.billableHourlyRate;
}

function calculateDiscountMultiplier(
	subtotalBeforeDiscount: number,
	discountAmount: number
): number {
	if (subtotalBeforeDiscount <= 0) return 1;
	return 1 - discountAmount / subtotalBeforeDiscount;
}

function calculateTargetPriceBeforeTax(directCost: number, targetMarginPercent: number): number {
	if (targetMarginPercent >= 100) return 0;
	return directCost / (1 - targetMarginPercent / 100);
}

function calculatePricingSummary(
	scenario: PricingScenarioInput,
	lineItems: PricingLineItemInput[],
	laborEntries: PricingLaborEntryInput[],
	fixedCosts: PricingFixedCostInput[]
): PricingSummary {
	const lineItemDirectCost = lineItems.reduce(
		(total, item) => total + calculateLineItemDirectCost(item),
		0
	);
	const laborDirectCost = laborEntries.reduce(
		(total, entry) => total + calculateLaborInternalCost(entry),
		0
	);
	const fixedDirectCost = fixedCosts.reduce((total, cost) => total + cost.cost, 0);
	const directCost = lineItemDirectCost + laborDirectCost + fixedDirectCost;

	const lineItemSellPrice = lineItems.reduce(
		(total, item) => total + calculateLineItemSellPrice(item),
		0
	);
	const laborSellPrice = laborEntries.reduce(
		(total, entry) => total + calculateLaborSellPrice(entry),
		0
	);
	const fixedCostSellPrice = fixedCosts.reduce(
		(total, cost) => total + calculateFixedCostSellPrice(cost),
		0
	);

	const contingencyAmount = directCost * (scenario.contingencyPercent / 100);
	const subtotalBeforeDiscount =
		lineItemSellPrice + laborSellPrice + fixedCostSellPrice + contingencyAmount;
	const discountAmount = subtotalBeforeDiscount * (scenario.discountPercent / 100);
	const discountMultiplier = calculateDiscountMultiplier(subtotalBeforeDiscount, discountAmount);

	const taxableLineItemSellPrice = lineItems
		.filter((item) => item.taxable)
		.reduce((total, item) => total + calculateLineItemSellPrice(item), 0);
	const taxableFixedCostSellPrice = fixedCosts
		.filter((cost) => cost.taxable)
		.reduce((total, cost) => total + calculateFixedCostSellPrice(cost), 0);
	const taxableSubtotal =
		(taxableLineItemSellPrice + taxableFixedCostSellPrice) * discountMultiplier;
	const taxAmount = taxableSubtotal * (scenario.taxRatePercent / 100);
	const finalPrice = subtotalBeforeDiscount - discountAmount + taxAmount;
	const priceBeforeTax = finalPrice - taxAmount;
	const grossProfit = priceBeforeTax - directCost;

	const marginPercent =
		directCost > 0 && priceBeforeTax > 0
			? roundPercent((grossProfit / priceBeforeTax) * 100)
			: null;
	const markupPercent = directCost > 0 ? roundPercent((grossProfit / directCost) * 100) : null;
	const targetMarginGap =
		marginPercent === null ? null : roundPercent(marginPercent - scenario.targetMarginPercent);
	const targetPriceBeforeTax = calculateTargetPriceBeforeTax(
		directCost,
		scenario.targetMarginPercent
	);

	return {
		breakEvenPriceBeforeTax: roundMoney(directCost),
		contingencyAmount: roundMoney(contingencyAmount),
		directCost: roundMoney(directCost),
		discountAmount: roundMoney(discountAmount),
		finalPrice: roundMoney(finalPrice),
		fixedCostSellPrice: roundMoney(fixedCostSellPrice),
		grossProfit: roundMoney(grossProfit),
		laborSellPrice: roundMoney(laborSellPrice),
		lineItemSellPrice: roundMoney(lineItemSellPrice),
		marginPercent,
		markupPercent,
		subtotalBeforeDiscount: roundMoney(subtotalBeforeDiscount),
		targetMarginGap,
		targetPriceBeforeTax: roundMoney(targetPriceBeforeTax),
		taxableSubtotal: roundMoney(taxableSubtotal),
		taxAmount: roundMoney(taxAmount),
	};
}

export { calculatePricingSummary };

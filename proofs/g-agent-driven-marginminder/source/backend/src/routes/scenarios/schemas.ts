import { t } from 'elysia';

import { FIELD_LENGTH_MEDIUM } from '../../constants/validation.ts';

const ScenarioStatusSchema = t.Union([
	t.Literal('approved'),
	t.Literal('archived'),
	t.Literal('draft'),
	t.Literal('review'),
]);

const PercentSchema = t.Number({ minimum: 0 });
const DiscountPercentSchema = t.Number({ maximum: 100, minimum: 0 });
const TargetMarginPercentSchema = t.Number({ maximum: 99.99, minimum: 0 });

const ScenarioLineItemCategorySchema = t.Union([
	t.Literal('fee'),
	t.Literal('labor'),
	t.Literal('material'),
	t.Literal('other'),
	t.Literal('overhead'),
	t.Literal('subcontractor'),
]);

const ScenarioLineItemSchema = t.Object({
	catalogItemId: t.Optional(t.Union([t.Null(), t.Number({ minimum: 1 })])),
	category: ScenarioLineItemCategorySchema,
	markupPercent: t.Optional(PercentSchema),
	name: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	notes: t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })])),
	quantity: t.Optional(t.Number({ minimum: 0 })),
	sortOrder: t.Optional(t.Number({ minimum: 0 })),
	taxable: t.Optional(t.Boolean()),
	unit: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	unitCost: t.Optional(t.Number({ minimum: 0 })),
});

const ScenarioLaborEntrySchema = t.Object({
	billableHourlyRate: t.Optional(t.Number({ minimum: 0 })),
	burdenPercent: t.Optional(PercentSchema),
	hours: t.Optional(t.Number({ minimum: 0 })),
	internalHourlyCost: t.Optional(t.Number({ minimum: 0 })),
	notes: t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })])),
	roleName: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	sortOrder: t.Optional(t.Number({ minimum: 0 })),
});

const ScenarioFixedCostSchema = t.Object({
	cost: t.Optional(t.Number({ minimum: 0 })),
	markupPercent: t.Optional(PercentSchema),
	name: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	notes: t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })])),
	sortOrder: t.Optional(t.Number({ minimum: 0 })),
	taxable: t.Optional(t.Boolean()),
});

const ScenarioCreateBodySchema = t.Object({
	assumptions: t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })])),
	contingencyPercent: t.Optional(PercentSchema),
	customerName: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	discountPercent: t.Optional(DiscountPercentSchema),
	fixedCosts: t.Optional(t.Array(ScenarioFixedCostSchema, { maxItems: 100 })),
	laborEntries: t.Optional(t.Array(ScenarioLaborEntrySchema, { maxItems: 100 })),
	lineItems: t.Optional(t.Array(ScenarioLineItemSchema, { maxItems: 200 })),
	notes: t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })])),
	status: t.Optional(ScenarioStatusSchema),
	targetMarginPercent: t.Optional(TargetMarginPercentSchema),
	taxRatePercent: t.Optional(PercentSchema),
	title: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
});

const ScenarioUpdateBodySchema = t.Partial(ScenarioCreateBodySchema);

const IdParamsSchema = t.Object({
	id: t.Numeric({ minimum: 1 }),
});

const ListScenariosQuerySchema = t.Object({
	includeArchived: t.Optional(t.Boolean({ default: false })),
	limit: t.Optional(t.Numeric({ default: 25, maximum: 100, minimum: 1 })),
	page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
	search: t.Optional(t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 })),
	status: t.Optional(ScenarioStatusSchema),
});

export {
	IdParamsSchema,
	ListScenariosQuerySchema,
	ScenarioCreateBodySchema,
	ScenarioUpdateBodySchema,
};

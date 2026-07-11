import { t } from 'elysia';

import type {
	CostCatalogInput,
	CostCatalogUpdateInput,
} from '../../services/costCatalogService.ts';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { FIELD_LENGTH_MEDIUM, FIELD_LENGTH_SHORT } from '../../constants/validation.ts';
import { VALIDATION_ERROR_CODES, validationError } from '../../utils/errorResponse.ts';

interface CostCatalogRouteInput {
	active?: boolean;
	category?: CostCatalogInput['category'];
	defaultMarkupPercent?: number;
	lastReviewedAt?: null | string;
	name?: string;
	notes?: null | string;
	taxable?: boolean;
	unit?: string;
	unitCost?: number;
}

const CostCatalogCategorySchema = t.Union([
	t.Literal('fee'),
	t.Literal('labor'),
	t.Literal('material'),
	t.Literal('other'),
	t.Literal('overhead'),
	t.Literal('subcontractor'),
]);

const NonNegativeNumberSchema = t.Number({ minimum: 0 });
const OptionalNullableTextSchema = t.Optional(t.Union([t.Null(), t.String({ maxLength: 4000 })]));
const OptionalReviewedDateSchema = t.Optional(
	t.Union([t.Null(), t.String({ maxLength: FIELD_LENGTH_SHORT, minLength: 1 })])
);

const CostCatalogCreateBodySchema = t.Object({
	active: t.Optional(t.Boolean()),
	category: CostCatalogCategorySchema,
	defaultMarkupPercent: t.Optional(NonNegativeNumberSchema),
	lastReviewedAt: OptionalReviewedDateSchema,
	name: t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 }),
	notes: OptionalNullableTextSchema,
	taxable: t.Optional(t.Boolean()),
	unit: t.String({ maxLength: FIELD_LENGTH_SHORT, minLength: 1 }),
	unitCost: t.Optional(NonNegativeNumberSchema),
});

const CostCatalogUpdateBodySchema = t.Partial(CostCatalogCreateBodySchema);

const IdParamsSchema = t.Object({
	id: t.Numeric({ minimum: 1 }),
});

const ListCostCatalogQuerySchema = t.Object({
	active: t.Optional(t.Boolean()),
	category: t.Optional(CostCatalogCategorySchema),
	includeArchived: t.Optional(t.Boolean({ default: false })),
	limit: t.Optional(t.Numeric({ default: 25, maximum: 100, minimum: 1 })),
	page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
	search: t.Optional(t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 })),
});

function parseReviewedDate(value: null | string | undefined): Date | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;

	return date;
}

function validateCostCatalogBody(
	body: CostCatalogRouteInput,
	set: { status?: number | string }
): CostCatalogInput | CostCatalogUpdateInput | null {
	const name = body.name;
	if (name !== undefined && name.trim().length === 0) {
		set.status = HTTP_STATUS.BAD_REQUEST;
		return null;
	}

	const unit = body.unit;
	if (unit !== undefined && unit.trim().length === 0) {
		set.status = HTTP_STATUS.BAD_REQUEST;
		return null;
	}

	const lastReviewedAt = parseReviewedDate(body.lastReviewedAt);
	if (body.lastReviewedAt !== undefined && lastReviewedAt === undefined) {
		set.status = HTTP_STATUS.BAD_REQUEST;
		return null;
	}

	const { lastReviewedAt: _lastReviewedAt, ...rest } = body;

	return {
		...rest,
		...(lastReviewedAt !== undefined ? { lastReviewedAt } : {}),
	};
}

function invalidCatalogBodyResponse() {
	return validationError(
		'Cost catalog input is invalid.',
		VALIDATION_ERROR_CODES.VALIDATION_FAILED,
		undefined,
		{
			lastReviewedAt: ['Use a valid date when last reviewed is provided.'],
			name: ['Name is required.'],
			unit: ['Unit is required.'],
		}
	);
}

export {
	CostCatalogCreateBodySchema,
	CostCatalogUpdateBodySchema,
	IdParamsSchema,
	invalidCatalogBodyResponse,
	ListCostCatalogQuerySchema,
	validateCostCatalogBody,
};

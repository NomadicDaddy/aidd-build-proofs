import type { TSchema } from '@sinclair/typebox';

import { t } from 'elysia';
import { CRITICALITY_LEVELS } from 'spernakit-shared';

import type { DependencyResult, ServiceResult } from '../../services/serviceCatalogQueries.ts';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../constants/pagination.ts';
import { FIELD_LENGTH_MEDIUM } from '../../constants/validation.ts';
import { badRequestError, conflictError, notFoundError } from '../../utils/errorResponse.ts';

const CRITICALITY_SCHEMA = t.Union(CRITICALITY_LEVELS.map((v) => t.Literal(v)));
const NAME = t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 });
const SHORT_TEXT = t.String({ maxLength: FIELD_LENGTH_MEDIUM });
const LONG_TEXT = t.String({ maxLength: 5000 });
const nullable = <T extends TSchema>(schema: T) => t.Optional(t.Union([schema, t.Null()]));

const idParams = t.Object({ id: t.Numeric({ minimum: 1 }) });
const dependencyParams = t.Object({
	dependencyId: t.Numeric({ minimum: 1 }),
	id: t.Numeric({ minimum: 1 }),
});

/** Writable fields shared by create (required name) and update (all optional). */
const writableFields = {
	category: nullable(SHORT_TEXT),
	criticality: t.Optional(CRITICALITY_SCHEMA),
	description: nullable(LONG_TEXT),
	expectedAvailability: nullable(SHORT_TEXT),
	notes: nullable(LONG_TEXT),
	ownerId: nullable(t.Integer({ minimum: 1 })),
	vendorId: nullable(t.Integer({ minimum: 1 })),
};

const createBody = t.Object({ ...writableFields, name: NAME });
const updateBody = t.Object({ ...writableFields, name: t.Optional(NAME) });

const dependencyBody = t.Object({
	dependencyType: nullable(SHORT_TEXT),
	dependsOnAssetId: nullable(t.Integer({ minimum: 1 })),
	dependsOnServiceId: nullable(t.Integer({ minimum: 1 })),
	notes: nullable(LONG_TEXT),
});

const listQuery = t.Object({
	category: t.Optional(SHORT_TEXT),
	criticality: t.Optional(CRITICALITY_SCHEMA),
	includeDeleted: t.Optional(t.Boolean()),
	limit: t.Optional(
		t.Numeric({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT, minimum: 1 })
	),
	ownerId: t.Optional(t.Numeric({ minimum: 1 })),
	page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
	search: t.Optional(t.String({ maxLength: 200 })),
});

/**
 * Map a failing service/dependency result to the matching HTTP status + error
 * envelope.
 *
 * @param result - A failing service or dependency result
 * @param set - Elysia response context (mutated to set the status code)
 * @returns The error response envelope
 */
function mapFailure(
	result: Exclude<DependencyResult | ServiceResult, { ok: true }>,
	set: { status?: number | string }
) {
	if (result.error === 'not_found') {
		set.status = HTTP_STATUS.NOT_FOUND;
		return notFoundError(result.message);
	}
	if (result.error === 'conflict') {
		set.status = HTTP_STATUS.CONFLICT;
		return conflictError(result.message);
	}
	set.status = HTTP_STATUS.UNPROCESSABLE_ENTITY;
	return badRequestError(result.message);
}

export {
	createBody,
	dependencyBody,
	dependencyParams,
	idParams,
	listQuery,
	mapFailure,
	updateBody,
};

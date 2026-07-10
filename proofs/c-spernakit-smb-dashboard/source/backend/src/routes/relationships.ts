import { Elysia, t } from 'elysia';
import {
	ASSET_RELATIONSHIP_TYPES,
	ASSET_STATUSES,
	CRITICALITY_LEVELS,
	RELATIONSHIP_CONFIDENCE_LEVELS,
} from 'spernakit-shared';

import type { RelationshipResult } from '../services/assetRelationshipService.ts';

import { HTTP_STATUS } from '../constants/httpStatus.ts';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants/pagination.ts';
import { assertUser, requireRoleFresh } from '../guards/role.ts';
import { requireDomainWorkspaceAccess, resolveWorkspaceScope } from '../guards/workspaceScope.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import {
	createRelationship,
	getRelationshipById,
	listRelationshipsEnriched,
	softDeleteRelationship,
	updateRelationship,
} from '../services/assetRelationshipService.ts';
import { getAssetById } from '../services/assetService.ts';
import { analyzeImpact } from '../services/impactAnalysisService.ts';
import { dataResponse, paginatedResponse } from '../utils/apiResponse.ts';
import { badRequestError, conflictError, notFoundError } from '../utils/errorResponse.ts';
import {
	CREATE_DETAIL,
	DELETE_DETAIL,
	GET_DETAIL,
	LIST_DETAIL,
	UPDATE_DETAIL,
} from './relationshipRouteDocs.ts';

const RELATIONSHIP_TYPE_SCHEMA = t.Union(ASSET_RELATIONSHIP_TYPES.map((v) => t.Literal(v)));
const CONFIDENCE_SCHEMA = t.Union(RELATIONSHIP_CONFIDENCE_LEVELS.map((v) => t.Literal(v)));
const ASSET_STATUS_SCHEMA = t.Union(ASSET_STATUSES.map((v) => t.Literal(v)));
const CRITICALITY_SCHEMA = t.Union(CRITICALITY_LEVELS.map((v) => t.Literal(v)));
const nullableNotes = t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()]));

const idParams = t.Object({ id: t.Numeric({ minimum: 1 }) });

const createBody = t.Object({
	allowUnusual: t.Optional(t.Boolean()),
	confidence: t.Optional(CONFIDENCE_SCHEMA),
	notes: nullableNotes,
	relationshipType: RELATIONSHIP_TYPE_SCHEMA,
	sourceAssetId: t.Integer({ minimum: 1 }),
	targetAssetId: t.Integer({ minimum: 1 }),
});

const updateBody = t.Object({
	allowUnusual: t.Optional(t.Boolean()),
	confidence: t.Optional(CONFIDENCE_SCHEMA),
	notes: nullableNotes,
	relationshipType: t.Optional(RELATIONSHIP_TYPE_SCHEMA),
});

const listQuery = t.Object({
	assetId: t.Optional(t.Numeric({ minimum: 1 })),
	confidence: t.Optional(CONFIDENCE_SCHEMA),
	criticality: t.Optional(CRITICALITY_SCHEMA),
	includeDeleted: t.Optional(t.Boolean()),
	limit: t.Optional(
		t.Numeric({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT, minimum: 1 })
	),
	ownerId: t.Optional(t.Numeric({ minimum: 1 })),
	page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
	relationshipType: t.Optional(RELATIONSHIP_TYPE_SCHEMA),
	search: t.Optional(t.String({ maxLength: 200 })),
	siteId: t.Optional(t.Numeric({ minimum: 1 })),
	sourceAssetId: t.Optional(t.Numeric({ minimum: 1 })),
	status: t.Optional(ASSET_STATUS_SCHEMA),
	targetAssetId: t.Optional(t.Numeric({ minimum: 1 })),
});

/**
 * Map a service failure result to the matching HTTP status + error envelope.
 *
 * @param result - A failing relationship result
 * @param set - Elysia response context (mutated to set the status code)
 * @returns The error response envelope
 */
function mapFailure(
	result: Exclude<RelationshipResult, { ok: true }>,
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

const relationshipRoutes = new Elysia({
	detail: { tags: ['Relationships'] },
	prefix: '/relationships',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/',
		({ query, user, workspaceId }) => {
			const result = listRelationshipsEnriched({
				assetId: query.assetId,
				confidence: query.confidence,
				criticality: query.criticality,
				includeDeleted: query.includeDeleted ?? false,
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				ownerId: query.ownerId,
				page: query.page ?? 1,
				relationshipType: query.relationshipType,
				search: query.search,
				siteId: query.siteId,
				sourceAssetId: query.sourceAssetId,
				status: query.status,
				targetAssetId: query.targetAssetId,
				workspaceScope: resolveWorkspaceScope(user, workspaceId),
			});
			return paginatedResponse(result);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: LIST_DETAIL,
			query: listQuery,
		}
	)
	.get(
		'/impact/:assetId',
		({ params, set, user, workspaceId }) => {
			// Scope the root asset so impact analysis cannot be run against, and
			// leak the dependency reach of, an asset in another workspace.
			const root = getAssetById(
				params.assetId,
				true,
				resolveWorkspaceScope(user, workspaceId)
			);
			if (!root) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			const analysis = analyzeImpact(params.assetId);
			if (!analysis.root) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			return dataResponse(analysis);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Compute the upstream (depends-on) and downstream (impact-if-offline) ' +
					'reach of an asset across the active relationship graph, including the ' +
					'business services affected. Answers "what breaks if this asset is offline?". ' +
					'Multi-hop; cycles are traversed once.',
				summary: 'Asset dependency impact analysis',
			},
			params: t.Object({ assetId: t.Numeric({ minimum: 1 }) }),
		}
	)
	.get(
		'/:id',
		({ params, query, set, user, workspaceId }) => {
			const row = getRelationshipById(
				params.id,
				query.includeDeleted ?? false,
				resolveWorkspaceScope(user, workspaceId)
			);
			if (!row) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Relationship');
			}
			return dataResponse(row);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: GET_DETAIL,
			params: idParams,
			query: t.Object({ includeDeleted: t.Optional(t.Boolean()) }),
		}
	)
	.post(
		'/',
		({ body, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const result = createRelationship(
				body,
				actor.id,
				resolveWorkspaceScope(actor, workspaceId)
			);
			if (!result.ok) {
				return mapFailure(result, set);
			}
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(result.row);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: createBody,
			detail: CREATE_DETAIL,
		}
	)
	.patch(
		'/:id',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scope = resolveWorkspaceScope(actor, workspaceId);
			if (scope !== null && !getRelationshipById(params.id, true, scope)) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Relationship');
			}
			const result = updateRelationship(params.id, body, actor.id);
			if (!result.ok) {
				return mapFailure(result, set);
			}
			return dataResponse(result.row);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: updateBody,
			detail: UPDATE_DETAIL,
			params: idParams,
		}
	)
	.delete(
		'/:id',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scope = resolveWorkspaceScope(actor, workspaceId);
			if (scope !== null && !getRelationshipById(params.id, true, scope)) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Relationship');
			}
			const deleted = softDeleteRelationship(params.id, actor.id);
			if (!deleted) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Relationship');
			}
			return dataResponse(deleted);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: DELETE_DETAIL,
			params: idParams,
		}
	);

export { relationshipRoutes };

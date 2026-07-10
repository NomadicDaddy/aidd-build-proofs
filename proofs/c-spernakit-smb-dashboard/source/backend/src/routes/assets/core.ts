import { Elysia, t } from 'elysia';
import { CHANGE_EVENT_ACTIONS } from 'spernakit-shared';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../constants/pagination.ts';
import {
	badRequestExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	paginatedExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { FIELD_LENGTH_MEDIUM } from '../../constants/validation.ts';
import { requireRoleFresh, resolveEffectiveRole } from '../../guards/role.ts';
import {
	requireDomainWorkspaceAccess,
	resolveWorkspaceScope,
} from '../../guards/workspaceScope.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import { listAssetChangeEvents } from '../../services/assetChangeEventQueries.ts';
import { getAssetById, listAssets } from '../../services/assetService.ts';
import { redactAssetForRole } from '../../services/assetVisibility.ts';
import { dataResponse, paginatedResponse } from '../../utils/apiResponse.ts';
import { badRequestError, notFoundError } from '../../utils/errorResponse.ts';
import { isValidDateString } from '../../utils/validation.ts';
import {
	ASSET_STATUS_SCHEMA,
	ASSET_TYPE_SCHEMA,
	CRITICALITY_SCHEMA,
	EXAMPLE_ASSET,
	idParams,
	PORT_EXPOSURE_SCHEMA,
	PORT_PROTOCOL_SCHEMA,
	PORT_REVIEW_SCHEMA,
} from './shared.ts';

const assetCoreRoutes = new Elysia({ detail: { tags: ['Assets'] }, prefix: '/assets' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/',
		({ query, user, workspaceId }) => {
			const result = listAssets({
				criticality: query.criticality,
				exposureLevel: query.exposureLevel,
				includeDeleted: query.includeDeleted ?? false,
				ip: query.ip,
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				operatingSystem: query.operatingSystem,
				ownerId: query.ownerId,
				page: query.page ?? 1,
				portNumber: query.portNumber,
				portReviewState: query.reviewState,
				portServiceId: query.serviceId,
				protocol: query.protocol,
				role: query.role,
				search: query.search,
				siteId: query.siteId,
				status: query.status,
				type: query.type,
				virtual: query.virtual,
				workspaceScope: resolveWorkspaceScope(user, workspaceId),
			});
			// Redact sensitive fields (notes, management URL, support contact)
			// for low-privilege viewers using the fresh, DB-verified role.
			const role = resolveEffectiveRole(user);
			const rows = result.data.map((asset) => redactAssetForRole(asset, role));
			return paginatedResponse(result, rows);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Returns a paginated, filterable list of assets. Supports filtering by ' +
					'name/hostname/FQDN/IP search, type, status, site, owner (business or ' +
					'technical), role, operating system, IP, virtualization state, and ' +
					'criticality. Soft-deleted assets are excluded unless includeDeleted=true. ' +
					'Requires VIEWER role or higher; VIEWER-level callers receive the ' +
					'sensitive notes, management URL, and support contact fields redacted ' +
					'to null (OPERATOR+ see the full record).',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: paginatedExample(
										'Asset inventory page',
										[EXAMPLE_ASSET],
										1
									),
								},
							},
						},
						description: 'Paginated list of assets.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List assets (VIEWER+)',
			},
			query: t.Object({
				criticality: t.Optional(CRITICALITY_SCHEMA),
				exposureLevel: t.Optional(PORT_EXPOSURE_SCHEMA),
				includeDeleted: t.Optional(t.Boolean()),
				ip: t.Optional(t.String({ maxLength: 45 })),
				limit: t.Optional(
					t.Numeric({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT, minimum: 1 })
				),
				operatingSystem: t.Optional(t.String({ maxLength: FIELD_LENGTH_MEDIUM })),
				ownerId: t.Optional(t.Numeric({ minimum: 1 })),
				page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
				portNumber: t.Optional(t.Numeric({ maximum: 65535, minimum: 0 })),
				protocol: t.Optional(PORT_PROTOCOL_SCHEMA),
				reviewState: t.Optional(PORT_REVIEW_SCHEMA),
				role: t.Optional(t.String({ maxLength: FIELD_LENGTH_MEDIUM })),
				search: t.Optional(t.String({ maxLength: FIELD_LENGTH_MEDIUM })),
				serviceId: t.Optional(t.Numeric({ minimum: 1 })),
				siteId: t.Optional(t.Numeric({ minimum: 1 })),
				status: t.Optional(ASSET_STATUS_SCHEMA),
				type: t.Optional(ASSET_TYPE_SCHEMA),
				virtual: t.Optional(t.Boolean()),
			}),
		}
	)
	.get(
		'/:id',
		({ params, query, set, user, workspaceId }) => {
			const asset = getAssetById(
				params.id,
				query.includeDeleted ?? false,
				resolveWorkspaceScope(user, workspaceId)
			);
			if (!asset) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			// Redact sensitive fields (notes, management URL, support contact)
			// for low-privilege viewers using the fresh, DB-verified role.
			const role = resolveEffectiveRole(user);
			return dataResponse(redactAssetForRole(asset, role));
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Returns a single asset by id. Soft-deleted assets are excluded unless ' +
					'includeDeleted=true. Requires VIEWER role or higher; VIEWER-level ' +
					'callers receive the sensitive notes, management URL, and support ' +
					'contact fields redacted to null (OPERATOR+ see the full record).',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: { success: dataExample('Asset detail', EXAMPLE_ASSET) },
							},
						},
						description: 'The requested asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Get an asset by id (VIEWER+)',
			},
			params: idParams,
			query: t.Object({ includeDeleted: t.Optional(t.Boolean()) }),
		}
	)
	.get(
		'/:id/history',
		({ params, query, set, user, workspaceId }) => {
			// History survives soft-deletion, so include deleted assets when
			// checking existence — a removed asset still has an auditable trail.
			// Scoped so a caller cannot read another workspace's asset history.
			const asset = getAssetById(params.id, true, resolveWorkspaceScope(user, workspaceId));
			if (!asset) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			if (query.dateFrom && !isValidDateString(query.dateFrom)) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					'Invalid dateFrom format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)'
				);
			}
			if (query.dateTo && !isValidDateString(query.dateTo)) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					'Invalid dateTo format. Use ISO 8601 (e.g. 2026-01-31T23:59:59Z)'
				);
			}
			if (
				query.dateFrom &&
				query.dateTo &&
				new Date(query.dateTo) < new Date(query.dateFrom)
			) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError('dateTo must be after or equal to dateFrom');
			}

			const result = listAssetChangeEvents({
				assetId: params.id,
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				page: query.page ?? DEFAULT_PAGE,
				...(query.action ? { action: query.action } : {}),
				...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
				...(query.dateTo ? { dateTo: query.dateTo } : {}),
			});
			return paginatedResponse(result, result.data);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Returns the paginated change-event audit trail for a single asset, newest ' +
					'first. Each entry records the action (create, update, delete, restore, ' +
					'archive, import), the acting user, the affected entity (the asset itself or ' +
					'a related record such as a relationship), a human-readable summary, and an ' +
					'optional before/after diff. The trail survives soft-deletion of the asset. ' +
					'Filterable by action and by ISO 8601 date range (dateFrom/dateTo, validated ' +
					'so dateTo is not before dateFrom). Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: paginatedExample(
										'Asset change history',
										[
											{
												action: 'update',
												actorId: 1,
												actorUsername: 'admin',
												assetId: 1,
												changes: {
													status: { from: 'active', to: 'retired' },
												},
												createdAt: '2026-07-03T14:30:00.000Z',
												entityId: 1,
												entityType: 'asset',
												id: 42,
												importId: null,
												summary: 'Updated asset DC01',
											},
										],
										1
									),
								},
							},
						},
						description: 'Paginated change-event trail for the asset.',
					},
					'400': badRequestExample(
						'Invalid dateFrom format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)'
					),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Get an asset change history (VIEWER+)',
			},
			params: idParams,
			query: t.Object({
				action: t.Optional(t.Union(CHANGE_EVENT_ACTIONS.map((v) => t.Literal(v)))),
				dateFrom: t.Optional(t.String({ maxLength: 50 })),
				dateTo: t.Optional(t.String({ maxLength: 50 })),
				limit: t.Optional(
					t.Numeric({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT, minimum: 1 })
				),
				page: t.Optional(t.Numeric({ default: DEFAULT_PAGE, minimum: 1 })),
			}),
		}
	);

export { assetCoreRoutes };

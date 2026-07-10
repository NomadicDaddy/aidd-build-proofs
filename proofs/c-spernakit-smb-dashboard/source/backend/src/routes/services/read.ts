import { Elysia, t } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { DEFAULT_PAGE_LIMIT } from '../../constants/pagination.ts';
import { FORBIDDEN_EXAMPLE, UNAUTHORIZED_EXAMPLE } from '../../constants/responseExamples.ts';
import { requireRoleFresh } from '../../guards/role.ts';
import {
	requireDomainWorkspaceAccess,
	resolveWorkspaceScope,
} from '../../guards/workspaceScope.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import { getServiceDetail, listServicesEnriched } from '../../services/serviceCatalogQueries.ts';
import { dataResponse, paginatedResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import { idParams, listQuery } from './shared.ts';

/**
 * Read-only catalog service routes: list services (enriched with owner/vendor
 * names and backing-asset counts) and fetch a single service with its backing
 * assets and dependencies. Reads are VIEWER+.
 */
const serviceReadRoutes = new Elysia({ detail: { tags: ['Services'] }, prefix: '/services' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/',
		({ query, user, workspaceId }) => {
			const result = listServicesEnriched({
				category: query.category,
				criticality: query.criticality,
				includeDeleted: query.includeDeleted ?? false,
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				ownerId: query.ownerId,
				page: query.page ?? 1,
				search: query.search,
				workspaceScope: resolveWorkspaceScope(user, workspaceId),
			});
			return paginatedResponse(result);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Returns a paginated, filterable list of catalog services with each ' +
					"service's owner and vendor resolved to a name and a count of its backing " +
					'assets. Filter by category, criticality, owner, or a free-text search over ' +
					'name/category/description. Requires VIEWER role or higher.',
				responses: {
					'200': { description: 'Paginated list of services.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List services (VIEWER+)',
			},
			query: listQuery,
		}
	)
	.get(
		'/:id',
		({ params, query, set, user, workspaceId }) => {
			const detail = getServiceDetail(
				params.id,
				query.includeDeleted ?? false,
				resolveWorkspaceScope(user, workspaceId)
			);
			if (!detail) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Service');
			}
			return dataResponse(detail);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Returns a single service by id with its backing assets and its ' +
					'dependencies (on other services and infrastructure assets) resolved to ' +
					'display names. Requires VIEWER role or higher.',
				responses: {
					'200': {
						description: 'The requested service with backing assets and dependencies.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': { description: 'Service not found.' },
				},
				summary: 'Get a service by id (VIEWER+)',
			},
			params: idParams,
			query: t.Object({ includeDeleted: t.Optional(t.Boolean()) }),
		}
	);

export { serviceReadRoutes };

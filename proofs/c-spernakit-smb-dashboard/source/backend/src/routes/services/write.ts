import { Elysia } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { FORBIDDEN_EXAMPLE, UNAUTHORIZED_EXAMPLE } from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import {
	requireDomainWorkspaceAccess,
	resolveWorkspaceScope,
} from '../../guards/workspaceScope.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import { getServiceById } from '../../services/serviceCatalogQueries.ts';
import {
	addServiceDependency,
	createService,
	removeServiceDependency,
	softDeleteService,
	updateService,
} from '../../services/serviceCatalogService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import {
	createBody,
	dependencyBody,
	dependencyParams,
	idParams,
	mapFailure,
	updateBody,
} from './shared.ts';

/**
 * Verify the target service is visible within the caller's workspace scope
 * before a write. Returns a 404 error envelope when the service is outside the
 * caller's workspace (indistinguishable from "not found", so a boundary is not
 * leaked), or undefined when the write may proceed. A no-op when scoping is off
 * or the caller is a cross-workspace SYSOP.
 */
function assertServiceInScope(
	id: number,
	scope: null | number,
	set: { status?: number | string }
): ReturnType<typeof notFoundError> | undefined {
	if (scope === null) return undefined;
	if (getServiceById(id, true, scope)) return undefined;
	set.status = HTTP_STATUS.NOT_FOUND;
	return notFoundError('Service');
}

/**
 * Write catalog service routes: create, update, soft-delete a service, and add
 * or remove a service dependency. All write actions are OPERATOR+.
 */
const serviceWriteRoutes = new Elysia({ detail: { tags: ['Services'] }, prefix: '/services' })
	.use(authPlugin)
	.use(workspacePlugin)
	.post(
		'/',
		({ body, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const result = createService(body, actor.id, resolveWorkspaceScope(actor, workspaceId));
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
			detail: {
				description:
					'Creates a new catalog service. Name is required and must be unique among ' +
					'active services (case-insensitive). Emits a change event. Requires ' +
					'OPERATOR role or higher.',
				responses: {
					'201': { description: 'The created service.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'409': { description: 'A service with that name already exists.' },
				},
				summary: 'Create a service (OPERATOR+)',
			},
		}
	)
	.patch(
		'/:id',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertServiceInScope(
				params.id,
				resolveWorkspaceScope(actor, workspaceId),
				set
			);
			if (scopeError) return scopeError;
			const result = updateService(params.id, body, actor.id);
			if (!result.ok) {
				return mapFailure(result, set);
			}
			return dataResponse(result.row);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: updateBody,
			detail: {
				description:
					'Updates an existing active service. All fields are optional; a changed ' +
					'name must remain unique among active services. Emits a change event. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': { description: 'The updated service.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': { description: 'Service not found.' },
					'409': { description: 'A service with that name already exists.' },
				},
				summary: 'Update a service (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.delete(
		'/:id',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertServiceInScope(
				params.id,
				resolveWorkspaceScope(actor, workspaceId),
				set
			);
			if (scopeError) return scopeError;
			const deleted = softDeleteService(params.id, actor.id);
			if (!deleted) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Service');
			}
			return dataResponse(deleted);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Soft-deletes a service (recoverable via the API). Emits a change event. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': { description: 'The soft-deleted service.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': { description: 'Service not found.' },
				},
				summary: 'Delete a service (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/dependencies',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertServiceInScope(
				params.id,
				resolveWorkspaceScope(actor, workspaceId),
				set
			);
			if (scopeError) return scopeError;
			const result = addServiceDependency(params.id, body, actor.id);
			if (!result.ok) {
				return mapFailure(result, set);
			}
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(result.row);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: dependencyBody,
			detail: {
				description:
					'Adds a dependency from this service onto exactly one target — another ' +
					'service (dependsOnServiceId) or an infrastructure asset (dependsOnAssetId). ' +
					'A service may not depend on itself. Requires OPERATOR role or higher.',
				responses: {
					'201': { description: 'The created dependency edge.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': { description: 'Service or dependency target not found.' },
					'422': {
						description: 'A dependency must target exactly one service or asset.',
					},
				},
				summary: 'Add a service dependency (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.delete(
		'/:id/dependencies/:dependencyId',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertServiceInScope(
				params.id,
				resolveWorkspaceScope(actor, workspaceId),
				set
			);
			if (scopeError) return scopeError;
			const removed = removeServiceDependency(params.id, params.dependencyId, actor.id);
			if (!removed) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Dependency');
			}
			return dataResponse(removed);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Removes a dependency edge from a service. The dependency must belong to ' +
					'the given service. Requires OPERATOR role or higher.',
				responses: {
					'200': { description: 'The removed dependency edge.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': { description: 'Dependency not found on the service.' },
				},
				summary: 'Remove a service dependency (OPERATOR+)',
			},
			params: dependencyParams,
		}
	);

export { serviceWriteRoutes };

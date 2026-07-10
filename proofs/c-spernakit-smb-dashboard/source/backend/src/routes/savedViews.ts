import { Elysia, t } from 'elysia';
import { SAVED_VIEW_NAME_MAX_LENGTH } from 'spernakit-shared';

import { HTTP_STATUS } from '../constants/httpStatus.ts';
import { FORBIDDEN_EXAMPLE, UNAUTHORIZED_EXAMPLE } from '../constants/responseExamples.ts';
import { assertUser, isSysop, requireAuth } from '../guards/role.ts';
import { requireWorkspaceAccess } from '../guards/workspaceAccess.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import {
	createSavedView,
	deleteSavedView,
	listSavedViews,
	updateSavedView,
} from '../services/savedViewService.ts';
import { dataResponse, successResponse } from '../utils/apiResponse.ts';
import { badRequestError, extractErrorMessage, notFoundError } from '../utils/errorResponse.ts';

/**
 * Resolve the active workspace scope for a saved-view query.
 *
 * SYSOP users with no explicit X-Workspace-ID header see all of their views
 * (cross-workspace). All other callers are scoped to the active workspace,
 * matching the dashboard_configs pattern.
 */
function resolveScope(user: { role: string }, workspaceId: null | number): null | number {
	if (isSysop(user as Parameters<typeof isSysop>[0]) && workspaceId === null) {
		return null;
	}
	return workspaceId;
}

/**
 * Guard workspace access for a write. SYSOPs operating cross-workspace (no
 * header) are permitted; everyone else must have access to the active workspace.
 */
function validateWriteWorkspace({
	set,
	user,
	workspaceId,
}: {
	set: { status?: number | string };
	user: Parameters<typeof isSysop>[0];
	workspaceId: null | number;
}): object | undefined {
	if (isSysop(user) && workspaceId === null) {
		return undefined;
	}
	return requireWorkspaceAccess({ set, user, workspaceId });
}

/** Request body shape shared by create and update. */
const savedViewBody = t.Object({
	filters: t.Record(t.String({ maxLength: 40 }), t.String({ maxLength: 200 })),
	name: t.String({ maxLength: SAVED_VIEW_NAME_MAX_LENGTH, minLength: 1 }),
});

const savedViewRoutes = new Elysia({ detail: { tags: ['Saved Views'] }, prefix: '/saved-views' })
	.use(authPlugin)
	.use(workspacePlugin)
	/* ------------------------------------------------------------------ */
	/*  GET /saved-views — list the caller's saved inventory views         */
	/* ------------------------------------------------------------------ */
	.get(
		'/',
		({ user, workspaceId }) => {
			const authUser = assertUser(user);
			const scope = resolveScope(authUser, workspaceId);
			return dataResponse(listSavedViews(authUser.id, scope));
		},
		{
			beforeHandle: requireAuth,
			detail: {
				description:
					'Returns every saved inventory filter view owned by the authenticated ' +
					'user in the active workspace, most-recent first. Requires authentication.',
				responses: {
					'200': { description: "The user's saved views." },
					'401': UNAUTHORIZED_EXAMPLE,
				},
				summary: 'List saved views',
			},
		}
	)
	/* ------------------------------------------------------------------ */
	/*  POST /saved-views — create a saved view                            */
	/* ------------------------------------------------------------------ */
	.post(
		'/',
		({ body, set, user, workspaceId }) => {
			const authUser = assertUser(user);
			const workspaceGuard = validateWriteWorkspace({ set, user: authUser, workspaceId });
			if (workspaceGuard) return workspaceGuard;

			try {
				const view = createSavedView(authUser.id, {
					filters: body.filters,
					name: body.name,
					workspaceId,
				});
				set.status = HTTP_STATUS.CREATED;
				return dataResponse(view);
			} catch (err) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(extractErrorMessage(err, 'Failed to create saved view'));
			}
		},
		{
			beforeHandle: requireAuth,
			body: savedViewBody,
			detail: {
				description:
					'Saves the current inventory filter selection under a name so it can be ' +
					're-applied later. Unknown filter keys are discarded. Requires authentication.',
				responses: {
					'201': { description: 'The created saved view.' },
					'400': {
						description: 'The saved view limit was reached or the body was invalid.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Create a saved view',
			},
		}
	)
	/* ------------------------------------------------------------------ */
	/*  PUT /saved-views/:id — update a saved view                         */
	/* ------------------------------------------------------------------ */
	.put(
		'/:id',
		({ body, params, set, user, workspaceId }) => {
			const authUser = assertUser(user);
			const scope = resolveScope(authUser, workspaceId);
			const view = updateSavedView(
				Number(params.id),
				authUser.id,
				{ filters: body.filters, name: body.name },
				scope
			);
			if (!view) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Saved view');
			}
			return dataResponse(view);
		},
		{
			beforeHandle: requireAuth,
			body: savedViewBody,
			detail: {
				description: "Updates a saved view's name and filters. Requires authentication.",
				responses: {
					'200': { description: 'The updated saved view.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'404': { description: 'Saved view not found.' },
				},
				summary: 'Update a saved view',
			},
			params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
		}
	)
	/* ------------------------------------------------------------------ */
	/*  DELETE /saved-views/:id — soft-delete a saved view                 */
	/* ------------------------------------------------------------------ */
	.delete(
		'/:id',
		({ params, set, user, workspaceId }) => {
			const authUser = assertUser(user);
			const scope = resolveScope(authUser, workspaceId);
			const deleted = deleteSavedView(Number(params.id), authUser.id, scope);
			if (!deleted) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Saved view');
			}
			return successResponse();
		},
		{
			beforeHandle: requireAuth,
			detail: {
				description: 'Soft-deletes a saved view. Requires authentication.',
				responses: {
					'200': { description: 'The saved view was deleted.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'404': { description: 'Saved view not found.' },
				},
				summary: 'Delete a saved view',
			},
			params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
		}
	);

export { savedViewRoutes };

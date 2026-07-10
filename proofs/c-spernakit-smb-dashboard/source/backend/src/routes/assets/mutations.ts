import { Elysia } from 'elysia';

import type { AuthPayload } from '../../plugins/auth.ts';
import type { ErrorResponse } from '../../utils/errorResponse.ts';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	conflictExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import {
	requireDomainWorkspaceAccess,
	resolveWorkspaceScope,
} from '../../guards/workspaceScope.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	archiveAsset,
	assetNameExists,
	createAsset,
	getAssetById,
	restoreAsset,
	softDeleteAsset,
	updateAsset,
} from '../../services/assetService.ts';
import { missingRequiredAssetFields } from '../../services/infrastructureSettingsService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, conflictError, notFoundError } from '../../utils/errorResponse.ts';
import {
	createAssetBody,
	EXAMPLE_ASSET,
	firstInvalidLifecycleDate,
	idParams,
	updateAssetBody,
} from './shared.ts';

/**
 * When workspace scoping restricts the caller to a single workspace, verify the
 * target asset belongs to it before a write. Returns a 404 error response to
 * short-circuit the mutation when the asset is outside the caller's workspace
 * (indistinguishable from "not found", so a boundary is not leaked), or
 * undefined when the write may proceed. A no-op when scoping is off or the
 * caller is a SYSOP operating cross-workspace.
 */
function assertAssetInScope(
	id: number,
	user: AuthPayload,
	workspaceId: null | number,
	set: { status?: number | string }
): ErrorResponse | undefined {
	const scope = resolveWorkspaceScope(user, workspaceId);
	if (scope === null) return undefined;
	if (getAssetById(id, true, scope)) return undefined;
	set.status = HTTP_STATUS.NOT_FOUND;
	return notFoundError('Asset');
}

const assetMutationRoutes = new Elysia({ detail: { tags: ['Assets'] }, prefix: '/assets' })
	.use(authPlugin)
	.use(workspacePlugin)
	.post(
		'/',
		({ body, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const invalidDate = firstInvalidLifecycleDate(body);
			if (invalidDate) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					`Invalid ${invalidDate} format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)`
				);
			}
			if (assetNameExists(body.name)) {
				set.status = HTTP_STATUS.CONFLICT;
				return conflictError(`An asset named "${body.name.trim()}" already exists`);
			}
			// Enforce the admin-configured required fields for manual asset entry.
			const missing = missingRequiredAssetFields(body);
			if (missing.length > 0) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					`The following fields are required by administrator policy: ${missing.join(', ')}`
				);
			}
			const created = createAsset(body, actor.id, resolveWorkspaceScope(actor, workspaceId));
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(created);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: createAssetBody,
			detail: {
				description:
					'Creates a new asset. Name and asset type are required; the name must be ' +
					'unique among active assets (case-insensitive). Emits an asset change event. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: { success: dataExample('Created asset', EXAMPLE_ASSET) },
							},
						},
						description: 'The created asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'409': conflictExample('An asset named "DC01" already exists'),
				},
				summary: 'Create an asset (OPERATOR+)',
			},
		}
	)
	.patch(
		'/:id',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertAssetInScope(params.id, actor, workspaceId, set);
			if (scopeError) return scopeError;
			const invalidDate = firstInvalidLifecycleDate(body);
			if (invalidDate) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					`Invalid ${invalidDate} format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)`
				);
			}
			if (body.name !== undefined && assetNameExists(body.name, params.id)) {
				set.status = HTTP_STATUS.CONFLICT;
				return conflictError(`An asset named "${body.name.trim()}" already exists`);
			}
			const updated = updateAsset(params.id, body, actor.id);
			if (!updated) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			return dataResponse(updated);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			body: updateAssetBody,
			detail: {
				description:
					'Updates an existing active asset. All fields are optional; a changed name ' +
					'must remain unique among active assets. Emits an asset change event. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: { success: dataExample('Updated asset', EXAMPLE_ASSET) },
							},
						},
						description: 'The updated asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
					'409': conflictExample('An asset named "DC01" already exists'),
				},
				summary: 'Update an asset (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.delete(
		'/:id',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertAssetInScope(params.id, actor, workspaceId, set);
			if (scopeError) return scopeError;
			const deleted = softDeleteAsset(params.id, actor.id);
			if (!deleted) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			return dataResponse(deleted);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Soft-deletes an asset (recoverable via restore). Emits an asset change ' +
					'event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Soft-deleted asset', {
										...EXAMPLE_ASSET,
										isDeleted: true,
									}),
								},
							},
						},
						description: 'The soft-deleted asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Soft-delete an asset (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/restore',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertAssetInScope(params.id, actor, workspaceId, set);
			if (scopeError) return scopeError;
			const restored = restoreAsset(params.id, actor.id);
			if (!restored) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			return dataResponse(restored);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Restores a previously soft-deleted asset. Emits an asset change event. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: { success: dataExample('Restored asset', EXAMPLE_ASSET) },
							},
						},
						description: 'The restored asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Restore a soft-deleted asset (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/archive',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const scopeError = assertAssetInScope(params.id, actor, workspaceId, set);
			if (scopeError) return scopeError;
			const archived = archiveAsset(params.id, actor.id);
			if (!archived) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			return dataResponse(archived);
		},
		{
			beforeHandle: (ctx) =>
				requireRoleFresh('OPERATOR')(ctx) ?? requireDomainWorkspaceAccess(ctx),
			detail: {
				description:
					'Archives an active asset by marking it retired and stamping its ' +
					'decommission date, while keeping the record queryable. Emits an asset ' +
					'change event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Archived asset', {
										...EXAMPLE_ASSET,
										status: 'retired',
									}),
								},
							},
						},
						description: 'The archived asset.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Archive an asset (OPERATOR+)',
			},
			params: idParams,
		}
	);

export { assetMutationRoutes };

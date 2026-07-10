import { Elysia } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	conflictExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	createServiceAssignment,
	deleteServiceAssignment,
	listAssignedServices,
	updateServiceAssignment,
} from '../../services/assetServiceAssignmentService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, conflictError, notFoundError } from '../../utils/errorResponse.ts';
import {
	assertAssetVisible,
	assignmentParams,
	createAssignmentBody,
	idParams,
	updateAssignmentBody,
} from './shared.ts';

const assetServiceAssignmentRoutes = new Elysia({
	detail: { tags: ['Assets'] },
	prefix: '/assets',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/:id/services',
		({ params, set, user, workspaceId }) => {
			const visibilityError = assertAssetVisible(params.id, user, workspaceId, set);
			if (visibilityError) return visibilityError;
			return dataResponse(listAssignedServices(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Lists the catalog services assigned to the asset, each resolved to its ' +
					'service name, category, and criticality, with the role label and primary ' +
					'flag recorded on the assignment. Primary assignments first. Soft-deleted ' +
					'services are excluded. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Asset service assignments', [
										{
											assignmentId: 1,
											isPrimary: true,
											role: 'Primary DNS',
											serviceCategory: 'infrastructure',
											serviceCriticality: 'critical',
											serviceId: 2,
											serviceName: 'DNS',
										},
									]),
								},
							},
						},
						description: 'The asset service assignments.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'List asset service assignments (VIEWER+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/services',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const result = createServiceAssignment(params.id, body, actor.id);
			if (!result.ok) {
				if (result.error === 'not_found') {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError(result.message);
				}
				if (result.error === 'conflict') {
					set.status = HTTP_STATUS.CONFLICT;
					return conflictError(result.message);
				}
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(result.message);
			}
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(result.row);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: createAssignmentBody,
			detail: {
				description:
					'Assigns a catalog service to the asset with an optional role label and ' +
					'primary flag. A service may be assigned to an asset at most once; setting ' +
					'isPrimary demotes any other asset marked primary for the same service. ' +
					'Emits an asset change event. Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Created service assignment', {
										assetId: 1,
										id: 3,
										isPrimary: false,
										role: 'Secondary',
										serviceId: 2,
									}),
								},
							},
						},
						description: 'The created service assignment.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Service'),
					'409': conflictExample('"DNS" is already assigned to this asset.'),
				},
				summary: 'Assign a service to an asset (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.patch(
		'/:id/services/:assignmentId',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const result = updateServiceAssignment(params.id, params.assignmentId, body, actor.id);
			if (!result.ok) {
				if (result.error === 'not_found') {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError(result.message);
				}
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(result.message);
			}
			return dataResponse(result.row);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: updateAssignmentBody,
			detail: {
				description:
					"Updates an asset's service assignment — its role label, primary flag, or " +
					'notes. The target service cannot be changed (delete and re-assign ' +
					'instead). Setting isPrimary demotes any other asset marked primary for ' +
					'the same service. Emits an asset change event. Requires OPERATOR role or ' +
					'higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Updated service assignment', {
										assetId: 1,
										id: 3,
										isPrimary: true,
										role: 'Primary',
										serviceId: 2,
									}),
								},
							},
						},
						description: 'The updated service assignment.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Service assignment'),
				},
				summary: 'Update an asset service assignment (OPERATOR+)',
			},
			params: assignmentParams,
		}
	)
	.delete(
		'/:id/services/:assignmentId',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const removed = deleteServiceAssignment(params.id, params.assignmentId, actor.id);
			if (!removed) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Service assignment');
			}
			return dataResponse(removed);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					'Removes a service assignment from the asset. Emits an asset change ' +
					'event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Deleted service assignment', {
										assetId: 1,
										id: 3,
										serviceId: 2,
									}),
								},
							},
						},
						description: 'The deleted service assignment.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Service assignment'),
				},
				summary: 'Unassign a service from an asset (OPERATOR+)',
			},
			params: assignmentParams,
		}
	);

export { assetServiceAssignmentRoutes };

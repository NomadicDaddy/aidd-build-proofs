import { Elysia } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	badRequestExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	createStorageAllocation,
	deleteStorageAllocation,
	listStorageAllocations,
	listStorageConsumers,
	updateStorageAllocation,
} from '../../services/assetStorageAllocationService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, notFoundError } from '../../utils/errorResponse.ts';
import { allocationParams, assertAssetVisible, idParams, storageAllocationBody } from './shared.ts';

const assetStorageRoutes = new Elysia({ detail: { tags: ['Assets'] }, prefix: '/assets' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/:id/storage-allocations',
		({ params, set, user, workspaceId }) => {
			const visibilityError = assertAssetVisible(params.id, user, workspaceId, set);
			if (visibilityError) return visibilityError;
			return dataResponse(listStorageAllocations(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					"Lists the asset's storage allocations (name, type, total and used " +
					'capacity, mount point, and the storage-pool asset each draws from), ' +
					'largest capacity first. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Asset storage allocations', [
										{
											assetId: 1,
											capacityGb: 2048,
											id: 1,
											mountPoint: '/data',
											name: 'Data volume',
											storagePoolAssetId: 5,
											storageType: 'iscsi',
											usedGb: 1200,
										},
									]),
								},
							},
						},
						description: 'The asset storage allocations.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'List asset storage allocations (VIEWER+)',
			},
			params: idParams,
		}
	)
	.get(
		'/:id/storage-consumers',
		({ params, set, user, workspaceId }) => {
			const visibilityError = assertAssetVisible(params.id, user, workspaceId, set);
			if (visibilityError) return visibilityError;
			return dataResponse(listStorageConsumers(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Lists the storage allocations that draw capacity from this asset acting ' +
					'as a storage pool or appliance, with each consuming asset resolved to its ' +
					'name. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Storage pool consumers', [
										{
											assetId: 2,
											capacityGb: 512,
											consumerAssetName: 'APP01 - Application Server',
											id: 3,
											storagePoolAssetId: 1,
											usedGb: 300,
										},
									]),
								},
							},
						},
						description: 'The assets drawing storage from this pool.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'List storage-pool consumers (VIEWER+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/storage-allocations',
		({ body, params, set, user }) => {
			const actor = assertUser(user);
			const result = createStorageAllocation(params.id, body, actor.id);
			if (!result.ok) {
				if (result.error === 'not_found') {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError(result.message);
				}
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(result.message);
			}
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(result.row);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: storageAllocationBody,
			detail: {
				description:
					'Adds a storage allocation to the asset. All fields are optional; used ' +
					'capacity may not exceed total capacity, and the storage-pool asset (when ' +
					'set) must exist. Emits an asset change event. Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Created storage allocation', {
										assetId: 1,
										capacityGb: 2048,
										id: 2,
										name: 'Backup volume',
										usedGb: 400,
									}),
								},
							},
						},
						description: 'The created storage allocation.',
					},
					'400': badRequestExample('Used capacity cannot exceed total capacity.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Add an asset storage allocation (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.patch(
		'/:id/storage-allocations/:allocationId',
		({ body, params, set, user }) => {
			const actor = assertUser(user);
			const result = updateStorageAllocation(params.id, params.allocationId, body, actor.id);
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
			body: storageAllocationBody,
			detail: {
				description:
					"Updates one of the asset's storage allocations. Fields omitted from the " +
					'body are left unchanged; null clears a field. Used capacity may not exceed ' +
					'total capacity. Emits an asset change event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Updated storage allocation', {
										assetId: 1,
										id: 2,
										usedGb: 512,
									}),
								},
							},
						},
						description: 'The updated storage allocation.',
					},
					'400': badRequestExample('Used capacity cannot exceed total capacity.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Storage allocation'),
				},
				summary: 'Update an asset storage allocation (OPERATOR+)',
			},
			params: allocationParams,
		}
	)
	.delete(
		'/:id/storage-allocations/:allocationId',
		({ params, set, user }) => {
			const actor = assertUser(user);
			const removed = deleteStorageAllocation(params.id, params.allocationId, actor.id);
			if (!removed) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Storage allocation');
			}
			return dataResponse(removed);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					"Deletes one of the asset's storage allocations. Emits an asset change " +
					'event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Deleted storage allocation', {
										assetId: 1,
										id: 2,
									}),
								},
							},
						},
						description: 'The deleted storage allocation.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Storage allocation'),
				},
				summary: 'Delete an asset storage allocation (OPERATOR+)',
			},
			params: allocationParams,
		}
	);

export { assetStorageRoutes };

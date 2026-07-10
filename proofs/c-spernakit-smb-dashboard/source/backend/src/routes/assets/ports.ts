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
	createAssetPort,
	deleteAssetPort,
	listAssetPorts,
	updateAssetPort,
} from '../../services/assetPortService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, notFoundError } from '../../utils/errorResponse.ts';
import { isValidDateString } from '../../utils/validation.ts';
import {
	assertAssetVisible,
	createPortBody,
	idParams,
	portParams,
	updatePortBody,
} from './shared.ts';

const assetPortRoutes = new Elysia({ detail: { tags: ['Assets'] }, prefix: '/assets' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/:id/ports',
		({ params, set, user, workspaceId }) => {
			const visibilityError = assertAssetVisible(params.id, user, workspaceId, set);
			if (visibilityError) return visibilityError;
			return dataResponse(listAssetPorts(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					"Lists the asset's documented and observed open ports — protocol, port " +
					'number, service name, scope, exposure level, source (documented vs ' +
					'imported scan), review state, verification date, and notes — ordered by ' +
					'port number then protocol. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Asset ports', [
										{
											assetId: 1,
											exposureLevel: 'internet',
											id: 1,
											portNumber: 443,
											protocol: 'tcp',
											reviewState: 'expected',
											serviceName: 'https',
											source: 'documented',
										},
									]),
								},
							},
						},
						description: 'The asset ports.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'List asset ports (VIEWER+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/ports',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			if (body.verifiedAt && !isValidDateString(body.verifiedAt)) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					'Invalid verifiedAt format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)'
				);
			}
			const result = createAssetPort(params.id, body, actor.id);
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
			body: createPortBody,
			detail: {
				description:
					'Documents an open port on the asset. The port number is required; ' +
					'protocol (default tcp), exposure level (default unknown), source (default ' +
					'documented), and review state (default expected) fall back to their ' +
					'defaults. Optionally attributes the port to a catalog service and records ' +
					'why it is open (notes) and when it was last verified. Emits an asset ' +
					'change event. Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Created port', {
										assetId: 1,
										id: 2,
										portNumber: 22,
										protocol: 'tcp',
										reviewState: 'expected',
										serviceName: 'ssh',
									}),
								},
							},
						},
						description: 'The created port.',
					},
					'400': badRequestExample('Service does not exist.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Add an asset port (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.patch(
		'/:id/ports/:portId',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			if (body.verifiedAt && !isValidDateString(body.verifiedAt)) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					'Invalid verifiedAt format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z)'
				);
			}
			const result = updateAssetPort(params.id, params.portId, body, actor.id);
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
			body: updatePortBody,
			detail: {
				description:
					"Updates one of the asset's ports — its protocol, port number, service " +
					'attribution, scope, exposure level, source, review state (expected, ' +
					'unexpected, ignored, historical, needs_review), verification date, or ' +
					'notes. Fields omitted from the body are left unchanged; null clears a ' +
					'nullable field. Emits an asset change event. Requires OPERATOR role or ' +
					'higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Updated port', {
										assetId: 1,
										id: 2,
										reviewState: 'unexpected',
									}),
								},
							},
						},
						description: 'The updated port.',
					},
					'400': badRequestExample('Service does not exist.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Port'),
				},
				summary: 'Update an asset port (OPERATOR+)',
			},
			params: portParams,
		}
	)
	.delete(
		'/:id/ports/:portId',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const removed = deleteAssetPort(params.id, params.portId, actor.id);
			if (!removed) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Port');
			}
			return dataResponse(removed);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					"Deletes one of the asset's ports. Emits an asset change event. Requires " +
					'OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Deleted port', { assetId: 1, id: 2 }),
								},
							},
						},
						description: 'The deleted port.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Port'),
				},
				summary: 'Delete an asset port (OPERATOR+)',
			},
			params: portParams,
		}
	);

export { assetPortRoutes };

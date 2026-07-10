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
	createNetworkInterface,
	deleteNetworkInterface,
	listNetworkInterfaces,
	updateNetworkInterface,
} from '../../services/assetNetworkInterfaceService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, notFoundError } from '../../utils/errorResponse.ts';
import { assertAssetVisible, idParams, interfaceParams, networkInterfaceBody } from './shared.ts';

const assetNetworkInterfaceRoutes = new Elysia({
	detail: { tags: ['Assets'] },
	prefix: '/assets',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/:id/network-interfaces',
		({ params, set, user, workspaceId }) => {
			const visibilityError = assertAssetVisible(params.id, user, workspaceId, set);
			if (visibilityError) return visibilityError;
			return dataResponse(listNetworkInterfaces(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					"Lists the asset's network interfaces (MAC, IP, subnet, gateway, VLAN, " +
					'DNS name, network zone), primary interface first. Requires VIEWER role ' +
					'or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Asset network interfaces', [
										{
											assetId: 1,
											dnsName: 'dc01.corp.local',
											id: 1,
											ipAddress: '10.0.0.10',
											isPrimary: true,
											macAddress: '00:1a:2b:3c:4d:5e',
											networkZoneId: 1,
											subnetMask: '255.255.255.0',
											vlanId: 10,
										},
									]),
								},
							},
						},
						description: 'The asset network interfaces.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'List asset network interfaces (VIEWER+)',
			},
			params: idParams,
		}
	)
	.post(
		'/:id/network-interfaces',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const result = createNetworkInterface(params.id, body, actor.id);
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
			body: networkInterfaceBody,
			detail: {
				description:
					'Adds a network interface to the asset. All fields are optional; setting ' +
					'isPrimary demotes any other primary interface on the asset. Emits an ' +
					'asset change event. Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Created network interface', {
										assetId: 1,
										id: 2,
										ipAddress: '10.0.0.11',
										name: 'eth1',
									}),
								},
							},
						},
						description: 'The created network interface.',
					},
					'400': badRequestExample('Network zone does not exist.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Add an asset network interface (OPERATOR+)',
			},
			params: idParams,
		}
	)
	.patch(
		'/:id/network-interfaces/:interfaceId',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const result = updateNetworkInterface(params.id, params.interfaceId, body, actor.id);
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
			body: networkInterfaceBody,
			detail: {
				description:
					"Updates one of the asset's network interfaces. Fields omitted from the " +
					'body are left unchanged; null clears a field. Setting isPrimary demotes ' +
					'any other primary interface. Emits an asset change event. Requires ' +
					'OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Updated network interface', {
										assetId: 1,
										id: 2,
										ipAddress: '10.0.0.12',
									}),
								},
							},
						},
						description: 'The updated network interface.',
					},
					'400': badRequestExample('Network zone does not exist.'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Network interface'),
				},
				summary: 'Update an asset network interface (OPERATOR+)',
			},
			params: interfaceParams,
		}
	)
	.delete(
		'/:id/network-interfaces/:interfaceId',
		({ params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const visibilityError = assertAssetVisible(params.id, actor, workspaceId, set);
			if (visibilityError) return visibilityError;
			const removed = deleteNetworkInterface(params.id, params.interfaceId, actor.id);
			if (!removed) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Network interface');
			}
			return dataResponse(removed);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					"Deletes one of the asset's network interfaces. Emits an asset change " +
					'event. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Deleted network interface', {
										assetId: 1,
										id: 2,
									}),
								},
							},
						},
						description: 'The deleted network interface.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Network interface'),
				},
				summary: 'Delete an asset network interface (OPERATOR+)',
			},
			params: interfaceParams,
		}
	);

export { assetNetworkInterfaceRoutes };

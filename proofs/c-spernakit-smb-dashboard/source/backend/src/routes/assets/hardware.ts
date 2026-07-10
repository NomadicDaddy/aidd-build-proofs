import { Elysia } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import { resolveWorkspaceScope } from '../../guards/workspaceScope.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	getHardwareProfile,
	upsertHardwareProfile,
} from '../../services/assetHardwareProfileService.ts';
import { getAssetById } from '../../services/assetService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import { hardwareProfileBody, idParams } from './shared.ts';

const assetHardwareRoutes = new Elysia({ detail: { tags: ['Assets'] }, prefix: '/assets' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/:id/hardware-profile',
		({ params, set, user, workspaceId }) => {
			const asset = getAssetById(params.id, true, resolveWorkspaceScope(user, workspaceId));
			if (!asset) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			// A profile is optional: an asset without one returns data: null so the
			// detail page can render an empty hardware section cleanly.
			return dataResponse(getHardwareProfile(params.id));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					"Returns the asset's hardware profile: CPU (model, cores, sockets, " +
					'threads), memory, total storage, hypervisor/hardware model, VM fields ' +
					'(guest OS, vCPU, tools status, snapshot notes, cluster), and physical-host ' +
					'fields (chassis, form factor, host role). Returns data: null when the ' +
					'asset has no profile yet. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Asset hardware profile', {
										assetId: 1,
										cpuCores: 16,
										cpuModel: 'Intel Xeon Silver 4310',
										hypervisor: 'VMware ESXi 8.0',
										id: 1,
										ramMb: 65536,
										totalStorageGb: 2048,
									}),
								},
							},
						},
						description: 'The hardware profile, or null when none exists.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Get an asset hardware profile (VIEWER+)',
			},
			params: idParams,
		}
	)
	.put(
		'/:id/hardware-profile',
		({ body, params, set, user, workspaceId }) => {
			const actor = assertUser(user);
			const asset = getAssetById(params.id, false, resolveWorkspaceScope(actor, workspaceId));
			if (!asset) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Asset');
			}
			const profile = upsertHardwareProfile(params.id, body, actor.id);
			return dataResponse(profile);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: hardwareProfileBody,
			detail: {
				description:
					"Creates or updates (upserts) the asset's one-to-one hardware profile. " +
					'All fields are optional; a first write creates the profile and later ' +
					'writes patch it in place. Emits an asset change event on the asset trail. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Saved hardware profile', {
										assetId: 1,
										cpuCores: 16,
										cpuModel: 'Intel Xeon Silver 4310',
										id: 1,
										ramMb: 65536,
									}),
								},
							},
						},
						description: 'The persisted hardware profile.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Asset'),
				},
				summary: 'Upsert an asset hardware profile (OPERATOR+)',
			},
			params: idParams,
		}
	);

export { assetHardwareRoutes };

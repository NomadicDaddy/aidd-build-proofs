import { Elysia } from 'elysia';

import { FORBIDDEN_EXAMPLE, UNAUTHORIZED_EXAMPLE } from '../constants/responseExamples.ts';
import { requireRoleFresh } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import { listOwners } from '../services/ownerService.ts';
import { dataResponse } from '../utils/apiResponse.ts';

const ownerRoutes = new Elysia({ detail: { tags: ['Owners'] }, prefix: '/owners' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get('/', () => dataResponse(listOwners()), {
		beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
		detail: {
			description:
				'Returns every active owner (accountable person, team, or vendor) ' +
				'ordered by name. Used to populate owner selectors on the service ' +
				'catalog and asset forms. Requires VIEWER role or higher.',
			responses: {
				'200': {
					description: 'The list of active owners.',
				},
				'401': UNAUTHORIZED_EXAMPLE,
				'403': FORBIDDEN_EXAMPLE,
			},
			summary: 'List owners (VIEWER+)',
		},
	});

export { ownerRoutes };

import { Elysia, t } from 'elysia';

import { FORBIDDEN_EXAMPLE, UNAUTHORIZED_EXAMPLE } from '../constants/responseExamples.ts';
import { FIELD_LENGTH_MEDIUM } from '../constants/validation.ts';
import { requireRoleFresh, resolveEffectiveRole } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import {
	DEFAULT_GROUP_LIMIT,
	globalSearch,
	MAX_GROUP_LIMIT,
} from '../services/globalSearchService.ts';
import { dataResponse } from '../utils/apiResponse.ts';

const searchRoutes = new Elysia({ detail: { tags: ['Search'] }, prefix: '/search' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/',
		({ query, user }) => {
			// Use the fresh, DB-verified role so restricted fields (asset notes,
			// management URL, support contact, owner email) are only searchable
			// by callers whose effective role permits seeing them.
			const role = resolveEffectiveRole(user);
			return dataResponse(globalSearch(query.q, role, query.limit));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Cross-domain global search across assets and services and their related ' +
					'records — asset names, hostnames, FQDNs, IP addresses (primary and per-' +
					'interface), MAC addresses, DNS names, serial numbers, asset tags, aliases, ' +
					'roles, operating systems, documented ports, and owners; plus service names, ' +
					'categories, and descriptions. Returns typed, grouped results (assets and ' +
					'services) with the fields each result matched on so the UI can link to the ' +
					'relevant detail page and explain the match. Requires VIEWER role or higher; ' +
					'restricted fields (asset notes, management URL, support contact, service ' +
					'notes, owner email) are only searched for OPERATOR+ callers so low-privilege ' +
					'viewers cannot locate records by content they may not see.',
				responses: {
					'200': { description: 'Grouped asset and service search results.' },
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Global search (VIEWER+)',
			},
			query: t.Object({
				limit: t.Optional(
					t.Numeric({
						default: DEFAULT_GROUP_LIMIT,
						maximum: MAX_GROUP_LIMIT,
						minimum: 1,
					})
				),
				q: t.String({ maxLength: FIELD_LENGTH_MEDIUM }),
			}),
		}
	);

export { searchRoutes };

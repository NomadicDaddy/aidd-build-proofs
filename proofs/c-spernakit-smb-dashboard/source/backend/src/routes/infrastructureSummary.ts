import { Elysia } from 'elysia';

import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';
import { requireRoleFresh } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import { getInfrastructureSummary } from '../services/assetSummaryService.ts';
import { dataResponse } from '../utils/apiResponse.ts';

const EXAMPLE_SUMMARY = {
	byCriticality: [{ count: 1, key: 'high', label: 'high' }],
	byOwner: [{ count: 1, key: 'unassigned', label: 'Unassigned' }],
	bySite: [{ count: 1, key: '1', label: 'HQ Datacenter' }],
	byStatus: [{ count: 1, key: 'active', label: 'active' }],
	byType: [{ count: 1, key: 'physical_server', label: 'physical_server' }],
	capacity: { profiledAssets: 1, totalCpuCores: 32, totalRamMb: 131072, totalStorageGb: 4096 },
	risks: {
		criticalWithoutBackup: 1,
		internetExposedPorts: 0,
		unknownPorts: 0,
		unownedAssets: 1,
		unsupportedOs: 0,
	},
	storage: {
		allocationCount: 3,
		poolCount: 1,
		totalCapacityGb: 8192,
		totalFreeGb: 3072,
		totalUsedGb: 5120,
	},
	topServices: [
		{ backingAssetCount: 2, criticality: 'critical', id: 1, name: 'Active Directory' },
	],
	totalAssets: 1,
	virtualization: { hypervisorHosts: 0, orphanVirtual: 0, physical: 1, virtual: 0 },
};

/**
 * Operational dashboard summary route. Aggregates the live asset inventory into
 * the counts, capacity, service, and risk figures the post-login dashboard renders.
 */
const infrastructureSummaryRoutes = new Elysia({
	detail: { tags: ['Infrastructure'] },
	prefix: '/infrastructure',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.get('/summary', () => dataResponse(getInfrastructureSummary()), {
		beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
		detail: {
			description:
				'Returns aggregate infrastructure figures for the operational dashboard: asset ' +
				'counts by type, status, site, owner, and criticality; physical/virtual and ' +
				'virtualization tallies; hardware capacity sums; top business services; and ' +
				'operational risk cues. Requires VIEWER role or higher.',
			responses: {
				'200': {
					content: {
						'application/json': {
							examples: {
								success: dataExample('Infrastructure summary', EXAMPLE_SUMMARY),
							},
						},
					},
					description: 'Aggregate infrastructure summary.',
				},
				'401': UNAUTHORIZED_EXAMPLE,
				'403': FORBIDDEN_EXAMPLE,
			},
			summary: 'Infrastructure dashboard summary (VIEWER+)',
		},
	});

export { infrastructureSummaryRoutes };

import { Elysia, t } from 'elysia';
import {
	DOCUMENTATION_HEALTH_SIGNALS,
	MAX_STALE_THRESHOLD_DAYS,
	MIN_STALE_THRESHOLD_DAYS,
} from 'spernakit-shared';

import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants/pagination.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	paginatedExample,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';
import { requireRoleFresh, resolveEffectiveRole } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import { redactAssetForRole } from '../services/assetVisibility.ts';
import {
	getDocumentationHealthSummary,
	listAssetsForSignal,
} from '../services/documentationHealthService.ts';
import { getInfrastructureSettings } from '../services/infrastructureSettingsService.ts';
import { dataResponse, paginatedResponse } from '../utils/apiResponse.ts';

const SIGNAL_SCHEMA = t.Union(DOCUMENTATION_HEALTH_SIGNALS.map((v) => t.Literal(v)));

// No schema default: when the caller omits thresholdDays the effective default
// is the admin-configured infrastructure stale-data threshold, resolved below.
const THRESHOLD_SCHEMA = t.Optional(
	t.Numeric({
		maximum: MAX_STALE_THRESHOLD_DAYS,
		minimum: MIN_STALE_THRESHOLD_DAYS,
	})
);

/** Effective stale-data threshold: explicit query value, else the configured default. */
function resolveThresholdDays(requested: number | undefined): number {
	return requested ?? getInfrastructureSettings().staleThresholdDays;
}

const EXAMPLE_SUMMARY = {
	signals: {
		missingBackup: 3,
		missingOwner: 2,
		missingRelationshipMap: 4,
		missingServiceRole: 5,
		stale: 6,
		unverifiedPorts: 1,
	},
	thresholdDays: 90,
	totalAssets: 12,
};

const EXAMPLE_ASSET = {
	assetType: 'physical_server',
	createdAt: '2026-07-03T12:00:00.000Z',
	criticality: 'high',
	hostname: 'dc01',
	id: 1,
	isDeleted: false,
	isVirtual: false,
	lastVerifiedAt: null,
	name: 'DC01 - Domain Controller',
	primaryIp: '10.0.0.10',
	siteId: 1,
	status: 'active',
};

/**
 * Documentation-health routes. Surfaces the completeness gaps the operational
 * dashboard flags (stale, missing owner/backup/relationship map/service role, and
 * unverified port data) both as aggregate signal counts and as drillable,
 * filterable per-signal asset lists. All reads require VIEWER role or higher.
 */
const documentationHealthRoutes = new Elysia({
	detail: { tags: ['Infrastructure'] },
	prefix: '/infrastructure',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'/documentation-health',
		({ query }) =>
			dataResponse(getDocumentationHealthSummary(resolveThresholdDays(query.thresholdDays))),
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns documentation-health signal counts for the live inventory: how many ' +
					'assets are stale (never verified, or last verified before the configurable ' +
					'stale-data threshold in days), have no owner, have no documented backup ' +
					'destination, appear in no relationship map, lack a documented service role, ' +
					'or carry unverified/needs-review port data. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample(
										'Documentation health summary',
										EXAMPLE_SUMMARY
									),
								},
							},
						},
						description: 'Documentation-health signal counts.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Documentation health summary (VIEWER+)',
			},
			query: t.Object({ thresholdDays: THRESHOLD_SCHEMA }),
		}
	)
	.get(
		'/documentation-health/assets',
		({ query, user }) => {
			const result = listAssetsForSignal({
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				page: query.page ?? DEFAULT_PAGE,
				signal: query.signal,
				thresholdDays: resolveThresholdDays(query.thresholdDays),
			});
			// Redact sensitive fields for low-privilege viewers using the fresh,
			// DB-verified role, matching the asset inventory endpoints.
			const role = resolveEffectiveRole(user);
			const rows = result.data.map((asset) => redactAssetForRole(asset, role));
			return paginatedResponse(result, rows);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns the paginated, name-ordered list of live assets that exhibit a given ' +
					'documentation-health gap (the filterable list view behind each dashboard ' +
					'signal). The stale signal honours the same configurable thresholdDays as the ' +
					'summary. Requires VIEWER role or higher; VIEWER-level callers receive the ' +
					'sensitive notes, management URL, and support contact fields redacted to null.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: paginatedExample(
										'Assets flagged by a documentation-health signal',
										[EXAMPLE_ASSET],
										1
									),
								},
							},
						},
						description: 'Paginated list of assets matching the signal.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List assets by documentation-health signal (VIEWER+)',
			},
			query: t.Object({
				limit: t.Optional(
					t.Numeric({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT, minimum: 1 })
				),
				page: t.Optional(t.Numeric({ default: DEFAULT_PAGE, minimum: 1 })),
				signal: SIGNAL_SCHEMA,
				thresholdDays: THRESHOLD_SCHEMA,
			}),
		}
	);

export { documentationHealthRoutes };

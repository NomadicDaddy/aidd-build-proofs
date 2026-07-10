import { Elysia, t } from 'elysia';
import {
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
	IMPORT_DUPLICATE_STRATEGIES,
	MAX_STALE_THRESHOLD_DAYS,
	MIN_STALE_THRESHOLD_DAYS,
	REQUIRABLE_ASSET_FIELDS,
} from 'spernakit-shared';

import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { log as logAudit } from '../../services/auditService.ts';
import {
	getInfrastructureSettings,
	updateInfrastructureSettings,
} from '../../services/infrastructureSettingsService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { setCacheHeaders } from '../../utils/caching.ts';

/** Optional, nullable enum literal — used by the dashboard filter preset fields. */
const nullableEnum = (values: readonly string[]) =>
	t.Optional(t.Union([...values.map((v) => t.Literal(v)), t.Null()]));

const EXAMPLE_SETTINGS = {
	defaultDashboardFilters: { assetType: null, criticality: 'high', status: 'active' },
	importBehavior: { duplicateStrategy: 'review', neverOverwriteNotes: true },
	requiredAssetFields: ['hostname', 'primaryIp'],
	staleThresholdDays: 90,
};

/**
 * Infrastructure domain settings routes. Exposes the administrator-managed
 * required fields, stale-data threshold, default dashboard filter preset, and
 * import behavior. Reads are VIEWER+ (non-sensitive operational config consumed
 * by the dashboard and inventory views); writes are ADMIN+.
 */
const settingsInfrastructureRoutes = new Elysia({
	detail: { tags: ['Settings'] },
	prefix: '/settings',
})
	.use(authPlugin)
	.get(
		'/infrastructure',
		({ set }) => {
			// Mutable — no cache.
			setCacheHeaders(set, 'NO_CACHE');
			return dataResponse(getInfrastructureSettings());
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns the infrastructure domain settings: the fields required for manual ' +
					'asset entry, the default stale-data threshold in days, the default dashboard/' +
					'inventory filter preset, and staged-import behavior. Seeds defaults on first ' +
					'access. Not HTTP-cached. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample(
										'Infrastructure settings',
										EXAMPLE_SETTINGS
									),
								},
							},
						},
						description: 'Current infrastructure settings.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Get infrastructure settings (VIEWER+)',
			},
		}
	)
	.put(
		'/infrastructure',
		({ body, user }) => {
			const authUser = assertUser(user);
			const settings = updateInfrastructureSettings(body, authUser.id);
			logAudit({
				action: 'SETTINGS_UPDATE',
				details: { changes: body, section: 'infrastructure' },
				entityId: 'infrastructure',
				entityType: 'settings',
				userId: authUser.id,
			});
			return dataResponse(settings);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('ADMIN')({ set, user }),
			body: t.Object({
				defaultDashboardFilters: t.Optional(
					t.Object({
						assetType: nullableEnum(ASSET_TYPES),
						criticality: nullableEnum(CRITICALITY_LEVELS),
						status: nullableEnum(ASSET_STATUSES),
					})
				),
				importBehavior: t.Optional(
					t.Object({
						duplicateStrategy: t.Optional(
							t.Union(IMPORT_DUPLICATE_STRATEGIES.map((v) => t.Literal(v)))
						),
						neverOverwriteNotes: t.Optional(t.Boolean()),
					})
				),
				requiredAssetFields: t.Optional(
					t.Array(t.Union(REQUIRABLE_ASSET_FIELDS.map((v) => t.Literal(v))), {
						maxItems: REQUIRABLE_ASSET_FIELDS.length,
					})
				),
				staleThresholdDays: t.Optional(
					t.Integer({
						maximum: MAX_STALE_THRESHOLD_DAYS,
						minimum: MIN_STALE_THRESHOLD_DAYS,
					})
				),
			}),
			detail: {
				description:
					'Updates infrastructure domain settings. All fields are optional; partial ' +
					'updates are merged onto the current settings (nested objects field-by-field). ' +
					'Invalid field names, out-of-range thresholds, and unknown enum values are ' +
					'rejected. Changes are recorded in the audit trail. Requires ADMIN role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample(
										'Updated infrastructure settings',
										EXAMPLE_SETTINGS
									),
								},
							},
						},
						description: 'Updated infrastructure settings.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Update infrastructure settings (ADMIN+)',
			},
		}
	);

export { settingsInfrastructureRoutes };

import { Elysia, t } from 'elysia';

import type { AuthPayload } from '../../plugins/auth.ts';

import { getConfig } from '../../config/configLoader.ts';
import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	dataExample,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, isSysop, requireAuth, requireRoleFresh } from '../../guards/role.ts';
import { requireWorkspaceAccess } from '../../guards/workspaceAccess.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { checkRouteLimit, createRateLimitStore } from '../../plugins/rateLimit/index.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	createFromTemplate,
	type DashboardExport,
	getSharedDashboard,
	importDashboard,
	listTemplates,
	type WidgetInput,
} from '../../services/dashboardService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { getClientIp } from '../../utils/clientIp.ts';
import {
	badRequestError,
	extractErrorMessage,
	notFoundError,
	RATE_ERROR_CODES,
	rateLimitError,
} from '../../utils/errorResponse.ts';
import { guardDashboardsEnabled, widgetSchema } from './schemas.ts';

/* Per-route rate limit for unauthenticated shared dashboard endpoint */
const SHARED_RATE_LIMIT_MAX = 30;
const SHARED_RATE_LIMIT_WINDOW_MS = 60_000;
const sharedRateStore = createRateLimitStore();

function checkSharedRateLimit(request: Request): { limited: boolean; retryAfter?: number } {
	const config = getConfig();
	if (!config.rateLimit.enabled || config.server.nodeEnv === 'development') {
		return { limited: false };
	}
	sharedRateStore.startCleanup();
	const ip = getClientIp(request);
	const result = checkRouteLimit(
		sharedRateStore,
		`shared:${ip}`,
		SHARED_RATE_LIMIT_MAX,
		SHARED_RATE_LIMIT_WINDOW_MS
	);
	if (result.limited) {
		return result.retryAfter !== undefined
			? { limited: true, retryAfter: result.retryAfter }
			: { limited: true };
	}
	return { limited: false };
}

function validateDashboardWriteWorkspace({
	set,
	user,
	workspaceId,
}: {
	set: { status?: number | string };
	user: AuthPayload;
	workspaceId: null | number;
}): object | undefined {
	if (isSysop(user) && workspaceId === null) {
		return undefined;
	}
	return requireWorkspaceAccess({ set, user, workspaceId });
}

function handleImportDashboard({
	body,
	set,
	user,
	workspaceId,
}: {
	body: { name: string; version: number; widgets: WidgetInput[] };
	set: { status?: number | string };
	user: AuthPayload | null;
	workspaceId: null | number;
}) {
	const authUser = assertUser(user);
	const workspaceGuard = validateDashboardWriteWorkspace({ set, user: authUser, workspaceId });
	if (workspaceGuard) return workspaceGuard;

	if (body.version !== 1) {
		set.status = HTTP_STATUS.BAD_REQUEST;
		return badRequestError(`Unsupported dashboard export version: ${body.version}`);
	}
	try {
		const widgets: WidgetInput[] = body.widgets.map((w) => ({
			col: w.col,
			height: w.height,
			metricType: w.metricType,
			...(w.options !== undefined ? { options: w.options } : {}),
			...(w.refreshInterval !== undefined ? { refreshInterval: w.refreshInterval } : {}),
			row: w.row,
			...(w.timeRange !== undefined ? { timeRange: w.timeRange } : {}),
			title: w.title,
			widgetType: w.widgetType,
			width: w.width,
		}));
		const data: DashboardExport = {
			name: body.name,
			version: 1,
			widgets,
		};
		const dashboard = importDashboard(authUser.id, data, workspaceId);
		set.status = HTTP_STATUS.CREATED;
		return dataResponse(dashboard);
	} catch (err) {
		set.status = HTTP_STATUS.BAD_REQUEST;
		return badRequestError(extractErrorMessage(err, 'Failed to import dashboard'));
	}
}

const dashboardTemplatesRoutes = new Elysia({
	detail: { tags: ['Dashboards'] },
	prefix: '/dashboards',
})
	.use(authPlugin)
	.use(workspacePlugin)
	.onBeforeHandle(guardDashboardsEnabled)
	/* ------------------------------------------------------------------ */
	/*  GET /dashboards/templates — list available templates               */
	/* ------------------------------------------------------------------ */
	.get(
		'/templates',
		() => {
			return dataResponse(listTemplates());
		},
		{
			beforeHandle: requireAuth,
			detail: {
				description:
					'Returns list of available dashboard templates that can be used ' +
					'to quickly create pre-configured dashboards.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Dashboard templates', [
										{
											id: 'system_overview',
											name: 'System Overview',
											widgetCount: 7,
										},
										{
											id: 'api_performance',
											name: 'API Performance',
											widgetCount: 6,
										},
									]),
								},
							},
						},
						description: 'Available dashboard templates.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
				},
				summary: 'List dashboard templates',
			},
		}
	)
	/* ------------------------------------------------------------------ */
	/*  GET /dashboards/shared/:token — view shared dashboard              */
	/* ------------------------------------------------------------------ */
	.get(
		'/shared/:token',
		({ params, set }) => {
			const dashboard = getSharedDashboard(params.token);
			if (!dashboard) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Dashboard');
			}
			return dataResponse(dashboard);
		},
		{
			beforeHandle: ({ request, set }) => {
				const result = checkSharedRateLimit(request);
				if (result.limited) {
					set.status = HTTP_STATUS.TOO_MANY_REQUESTS;
					set.headers['Retry-After'] = String(result.retryAfter ?? 0);
					return rateLimitError(
						result.retryAfter ?? 0,
						RATE_ERROR_CODES.RATE_API_LIMIT_EXCEEDED
					);
				}
				return undefined;
			},
			detail: {
				description:
					'View a shared dashboard by its share token. Does not require authentication. ' +
					'Returns full dashboard with widgets if token is valid and not expired.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Shared dashboard', {
										id: 1,
										name: 'Shared System Dashboard',
										widgets: [],
									}),
								},
							},
						},
						description: 'Shared dashboard with widgets.',
					},
					'404': notFoundExample('Dashboard'),
				},
				summary: 'View shared dashboard',
			},
			params: t.Object({
				token: t.String({ maxLength: 500, minLength: 1 }),
			}),
		}
	)
	/* ------------------------------------------------------------------ */
	/*  POST /dashboards/from-template — create from template              */
	/* ------------------------------------------------------------------ */
	.post(
		'/from-template',
		({ body, set, user, workspaceId }) => {
			const authUser = assertUser(user);
			const workspaceGuard = validateDashboardWriteWorkspace({
				set,
				user: authUser,
				workspaceId,
			});
			if (workspaceGuard) return workspaceGuard;

			try {
				const dashboard = createFromTemplate(authUser.id, body.templateId, workspaceId);
				if (!dashboard) {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError('Template');
				}
				set.status = HTTP_STATUS.CREATED;
				return dataResponse(dashboard);
			} catch (err) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					extractErrorMessage(err, 'Failed to create dashboard from template')
				);
			}
		},
		{
			beforeHandle: requireRoleFresh('OPERATOR'),
			body: t.Object({
				templateId: t.String({ maxLength: 100, minLength: 1 }),
			}),
			detail: {
				description:
					'Create a new dashboard from a pre-built template. Templates provide ' +
					'pre-configured widget layouts for common monitoring scenarios.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Created from template', {
										id: 2,
										name: 'System Overview',
										widgets: [],
									}),
								},
							},
						},
						description: 'Dashboard created from template.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'404': notFoundExample('Template'),
				},
				summary: 'Create dashboard from template',
			},
		}
	)
	/* ------------------------------------------------------------------ */
	/*  POST /dashboards/import — import dashboard from JSON               */
	/* ------------------------------------------------------------------ */
	.post('/import', handleImportDashboard, {
		beforeHandle: requireRoleFresh('OPERATOR'),
		body: t.Object({
			name: t.String({ maxLength: 100, minLength: 1 }),
			version: t.Integer({ minimum: 1 }),
			widgets: t.Array(widgetSchema),
		}),
		detail: {
			description:
				'Import a dashboard from a previously exported JSON structure. ' +
				'Validates the schema before creating the dashboard.',
			responses: {
				'201': {
					content: {
						'application/json': {
							examples: {
								success: dataExample('Imported dashboard', {
									id: 3,
									name: 'Imported Dashboard',
									widgets: [],
								}),
							},
						},
					},
					description: 'Dashboard imported successfully.',
				},
				'401': UNAUTHORIZED_EXAMPLE,
			},
			summary: 'Import dashboard',
		},
	});

export { dashboardTemplatesRoutes };

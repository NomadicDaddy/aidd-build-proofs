import { Elysia, t } from 'elysia';

import { HTTP_STATUS } from '../constants/httpStatus.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';
import { assertUser, requireRoleFresh, resolveEffectiveRole } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { workspacePlugin } from '../plugins/workspace.ts';
import { log as logAudit } from '../services/auditService.ts';
import {
	buildReport,
	getInfrastructureSummary,
	isReportKey,
	listReports,
} from '../services/reportService.ts';
import { dataResponse } from '../utils/apiResponse.ts';
import { toCsv } from '../utils/csv.ts';
import { notFoundError } from '../utils/errorResponse.ts';

const keyParams = t.Object({ key: t.String({ maxLength: 64, minLength: 1 }) });

/**
 * Reporting and export routes. Every dataset the dashboard tracks — assets,
 * relationships, services, ports, and the management summary — plus
 * audit-friendly reports (change history, ownership gaps, exposed ports,
 * lifecycle status) can be pulled as structured JSON or downloaded as CSV.
 *
 * All reads are VIEWER+; asset-derived reports are permission-filtered — a
 * VIEWER receives sensitive asset fields (notes, management URL, support
 * contact) redacted, exactly as the inventory list does.
 */
const reportRoutes = new Elysia({ detail: { tags: ['Reports'] }, prefix: '/reports' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get('', () => dataResponse(listReports()), {
		beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
		detail: {
			description:
				'Lists every available report and export with its key, label, description, ' +
				'and category (data or audit). Requires VIEWER role or higher.',
			responses: {
				'200': {
					content: {
						'application/json': {
							examples: {
								success: dataExample('Available reports', [
									{
										category: 'data',
										description: 'Every active asset…',
										key: 'assets',
										label: 'Assets',
									},
								]),
							},
						},
					},
					description: 'The report catalog.',
				},
				'401': UNAUTHORIZED_EXAMPLE,
				'403': FORBIDDEN_EXAMPLE,
			},
			summary: 'List available reports (VIEWER+)',
		},
	})
	.get('/summary', () => dataResponse(getInfrastructureSummary()), {
		beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
		detail: {
			description:
				'Returns the full management summary payload (counts by type, status, ' +
				'criticality, site, and owner, plus capacity, virtualization, top services, ' +
				'and risk indicators) for a printable/exportable overview. Requires VIEWER+.',
			responses: {
				'200': {
					content: {
						'application/json': {
							examples: {
								success: dataExample('Management summary', {
									risks: { unownedAssets: 0 },
									totalAssets: 42,
								}),
							},
						},
					},
					description: 'The infrastructure management summary.',
				},
				'401': UNAUTHORIZED_EXAMPLE,
				'403': FORBIDDEN_EXAMPLE,
			},
			summary: 'Management summary payload (VIEWER+)',
		},
	})
	.get(
		'/:key',
		({ params, query, set, user }) => {
			if (!isReportKey(params.key)) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Report');
			}
			const actor = assertUser(user);
			const role = resolveEffectiveRole(user);
			const payload = buildReport(params.key, { role });
			if (!payload) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Report');
			}
			const format = query.format ?? 'json';
			logAudit({
				action: 'REPORT_EXPORT',
				details: { format, key: params.key, rowCount: payload.rows.length },
				entityId: params.key,
				entityType: 'report',
				userId: actor.id,
			});
			set.headers['x-content-type-options'] = 'nosniff';
			if (format === 'csv') {
				set.headers['content-type'] = 'text/csv; charset=utf-8';
				set.headers['content-disposition'] =
					`attachment; filename="${params.key}-report.csv"`;
				return new Response(toCsv(payload.columns, payload.rows));
			}
			set.headers['content-type'] = 'application/json; charset=utf-8';
			set.headers['content-disposition'] = `attachment; filename="${params.key}-report.json"`;
			return new Response(
				JSON.stringify({ columns: payload.columns, rows: payload.rows }, null, 2)
			);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Builds and downloads a single report by key as a file attachment: ' +
					'format=csv (a CSV document) or format=json (default; a JSON object with ' +
					'columns and rows). Asset-derived reports are permission-filtered by the ' +
					"caller's role. Every export is audited. Requires VIEWER role or higher.",
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Report', {
										columns: [{ key: 'name', label: 'Name' }],
										key: 'assets',
										rows: [{ name: 'web-01' }],
									}),
								},
							},
						},
						description: 'The report payload (JSON) or a CSV file attachment.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Report'),
				},
				summary: 'Get or export a report (VIEWER+)',
			},
			params: keyParams,
			query: t.Object({
				format: t.Optional(t.Union([t.Literal('csv'), t.Literal('json')])),
			}),
		}
	);

export { reportRoutes };

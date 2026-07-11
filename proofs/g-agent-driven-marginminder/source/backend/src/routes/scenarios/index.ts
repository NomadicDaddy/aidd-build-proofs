import { Elysia } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import {
	archiveScenario,
	createScenario,
	getScenarioDetail,
	listScenarios,
	updateScenario,
} from '../../services/scenarioService.ts';
import { dataResponse, successResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import {
	IdParamsSchema,
	ListScenariosQuerySchema,
	ScenarioCreateBodySchema,
	ScenarioUpdateBodySchema,
} from './schemas.ts';
const scenariosRoutes = new Elysia({ detail: { tags: ['Quote Scenarios'] }, prefix: '/scenarios' })
	.use(authPlugin)
	.get(
		'/',
		({ query }) => {
			return dataResponse(
				listScenarios({
					includeArchived: query.includeArchived ?? false,
					limit: query.limit ?? 25,
					page: query.page ?? 1,
					...(query.search ? { search: query.search } : {}),
					...(query.status ? { status: query.status } : {}),
				})
			);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns a bounded list of quote scenarios with current pricing summary fields. ' +
					'Archived scenarios are hidden by default. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Quote scenarios', {
										data: [
											{
												customerName: 'Acme Coffee',
												finalPrice: 1895,
												id: 1,
												marginPercent: 38.2,
												riskCount: 0,
												status: 'draft',
												targetMarginPercent: 35,
												title: 'Counter installation',
											},
										],
										limit: 25,
										page: 1,
										total: 1,
									}),
								},
							},
						},
						description: 'List of quote scenarios.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List quote scenarios (VIEWER+)',
			},
			query: ListScenariosQuerySchema,
		}
	)
	.post(
		'/',
		({ body, set }) => {
			set.status = HTTP_STATUS.CREATED;
			return dataResponse(createScenario(body));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: ScenarioCreateBodySchema,
			detail: {
				description:
					'Creates a quote scenario shell with validated assumptions. Line items, labor, ' +
					'and fixed costs are stored separately and included in the returned detail shape. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Quote scenario created', {
										scenario: {
											customerName: 'Acme Coffee',
											id: 1,
											status: 'draft',
											targetMarginPercent: 35,
											title: 'Counter installation',
										},
										summary: {
											directCost: 0,
											finalPrice: 0,
											marginPercent: null,
											riskFlags: [],
										},
									}),
								},
							},
						},
						description: 'Quote scenario created.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Create quote scenario (OPERATOR+)',
			},
		}
	)
	.get(
		'/:id',
		({ params, set }) => {
			const detail = getScenarioDetail(params.id);
			if (!detail) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Quote scenario');
			}
			return dataResponse(detail);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns a quote scenario with line items, labor entries, fixed costs, and a ' +
					'server-calculated pricing summary. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Quote scenario detail', {
										fixedCosts: [],
										laborEntries: [],
										lineItems: [],
										scenario: {
											customerName: 'Acme Coffee',
											id: 1,
											status: 'draft',
											title: 'Counter installation',
										},
										summary: { directCost: 0, finalPrice: 0 },
									}),
								},
							},
						},
						description: 'Quote scenario detail.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Quote scenario'),
				},
				summary: 'Get quote scenario detail (VIEWER+)',
			},
			params: IdParamsSchema,
		}
	)
	.put(
		'/:id',
		({ body, params, set }) => {
			const detail = updateScenario(params.id, body);
			if (!detail) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Quote scenario');
			}
			return dataResponse(detail);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: ScenarioUpdateBodySchema,
			detail: {
				description:
					'Updates quote scenario assumptions and returns the refreshed detail with ' +
					'server-calculated pricing summary. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Quote scenario updated', {
										scenario: {
											discountPercent: 5,
											id: 1,
											status: 'review',
										},
									}),
								},
							},
						},
						description: 'Quote scenario updated.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Quote scenario'),
				},
				summary: 'Update quote scenario (OPERATOR+)',
			},
			params: IdParamsSchema,
		}
	)
	.delete(
		'/:id',
		({ params, set }) => {
			if (!archiveScenario(params.id)) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Quote scenario');
			}
			return successResponse();
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					'Archives a quote scenario by setting status to archived. Scenario child rows ' +
					'are retained for historical review. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: {
										summary: 'Scenario archived',
										value: { data: null },
									},
								},
							},
						},
						description: 'Quote scenario archived.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Quote scenario'),
				},
				summary: 'Archive quote scenario (OPERATOR+)',
			},
			params: IdParamsSchema,
		}
	)
	.get(
		'/:id/summary',
		({ params, set }) => {
			const detail = getScenarioDetail(params.id);
			if (!detail) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Quote scenario');
			}
			return dataResponse(detail.summary);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns the server-calculated quote scenario pricing summary and risk flags. ' +
					'Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Quote scenario summary', {
										directCost: 1250,
										finalPrice: 1895,
										marginPercent: 34,
										riskFlags: [],
									}),
								},
							},
						},
						description: 'Quote scenario summary.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Quote scenario'),
				},
				summary: 'Get quote scenario summary (VIEWER+)',
			},
			params: IdParamsSchema,
		}
	);

export { scenariosRoutes };

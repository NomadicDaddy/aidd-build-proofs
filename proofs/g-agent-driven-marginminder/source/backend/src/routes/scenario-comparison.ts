import { Elysia, t } from 'elysia';

import { HTTP_STATUS } from '../constants/httpStatus.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';
import { requireRoleFresh } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { compareScenarios } from '../services/scenarioService.ts';
import { dataResponse } from '../utils/apiResponse.ts';
import { VALIDATION_ERROR_CODES, validationError } from '../utils/errorResponse.ts';

const scenarioComparisonRoutes = new Elysia({
	detail: { tags: ['Quote Scenarios'] },
	prefix: '/scenario-comparison',
})
	.use(authPlugin)
	.post(
		'/',
		({ body, set }) => {
			const uniqueIds = [...new Set(body.scenarioIds)];
			if (uniqueIds.length < 2) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return validationError(
					'Select at least two distinct scenarios to compare.',
					VALIDATION_ERROR_CODES.VALIDATION_FAILED,
					undefined,
					{ scenarioIds: ['At least two distinct scenario IDs are required.'] }
				);
			}

			const comparison = compareScenarios(uniqueIds);
			if (comparison.scenarios.length !== uniqueIds.length) {
				set.status = HTTP_STATUS.BAD_REQUEST;
				return validationError(
					'One or more selected scenarios could not be found.',
					VALIDATION_ERROR_CODES.VALIDATION_FAILED,
					undefined,
					{ scenarioIds: ['Every selected scenario ID must exist.'] }
				);
			}

			return dataResponse(comparison);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			body: t.Object({
				scenarioIds: t.Array(t.Numeric({ minimum: 1 }), {
					maxItems: 10,
					minItems: 2,
				}),
			}),
			detail: {
				description:
					'Compares two to ten saved quote scenarios and returns server-calculated ' +
					'pricing summaries for each selected scenario. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Scenario comparison', {
										scenarios: [
											{
												customerName: 'Acme Coffee',
												id: 1,
												summary: {
													directCost: 1250,
													finalPrice: 1895,
													marginPercent: 34,
												},
												title: 'Counter installation',
											},
											{
												customerName: 'Acme Coffee',
												id: 2,
												summary: {
													directCost: 1300,
													finalPrice: 2100,
													marginPercent: 38.1,
												},
												title: 'Counter installation with rush fee',
											},
										],
									}),
								},
							},
						},
						description: 'Scenario comparison summaries.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Compare quote scenarios (VIEWER+)',
			},
		}
	);

export { scenarioComparisonRoutes };

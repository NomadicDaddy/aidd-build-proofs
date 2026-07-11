import { Elysia } from 'elysia';

import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';
import { requireRoleFresh } from '../guards/role.ts';
import { authPlugin } from '../plugins/auth.ts';
import { getPricingDashboard } from '../services/scenarioService.ts';
import { dataResponse } from '../utils/apiResponse.ts';

const pricingDashboardRoutes = new Elysia({
	detail: { tags: ['Pricing Dashboard'] },
	prefix: '/dashboard',
})
	.use(authPlugin)
	.get(
		'/',
		() => {
			return dataResponse(getPricingDashboard());
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns Margin Minder pricing health metrics, recent scenarios, and risk counts. ' +
					'Archived scenarios are excluded. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Pricing dashboard', {
										averageMarginPercent: 32.4,
										belowTargetCount: 1,
										draftCount: 2,
										recentScenarios: [
											{
												customerName: 'Acme Coffee',
												finalPrice: 1895,
												id: 1,
												marginPercent: 34,
												riskCount: 1,
												status: 'draft',
												targetMarginPercent: 35,
												title: 'Counter installation',
											},
										],
										totalScenarios: 5,
									}),
								},
							},
						},
						description: 'Pricing dashboard summary.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Get pricing dashboard (VIEWER+)',
			},
		}
	);

export { pricingDashboardRoutes };

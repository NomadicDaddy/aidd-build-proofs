import { Elysia } from 'elysia';

import type { CostCatalogInput } from '../../services/costCatalogService.ts';

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
	archiveCostCatalogItem,
	createCostCatalogItem,
	getCostCatalogItem,
	listCostCatalogItems,
	updateCostCatalogItem,
} from '../../services/costCatalogService.ts';
import { dataResponse, paginatedResponse, successResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import {
	CostCatalogCreateBodySchema,
	CostCatalogUpdateBodySchema,
	IdParamsSchema,
	invalidCatalogBodyResponse,
	ListCostCatalogQuerySchema,
	validateCostCatalogBody,
} from './schemas.ts';

const costCatalogRoutes = new Elysia({
	detail: { tags: ['Cost Catalog'] },
	prefix: '/cost-catalog',
})
	.use(authPlugin)
	.get(
		'/',
		({ query }) => {
			return paginatedResponse(
				listCostCatalogItems({
					...(query.active !== undefined ? { active: query.active } : {}),
					...(query.category ? { category: query.category } : {}),
					includeArchived: query.includeArchived ?? false,
					limit: query.limit ?? 25,
					page: query.page ?? 1,
					...(query.search ? { search: query.search } : {}),
				})
			);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns reusable cost catalog assumptions. Archived items are hidden by ' +
					'default so they are not suggested for new scenario lines. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Cost catalog items', {
										data: [
											{
												active: true,
												category: 'material',
												defaultMarkupPercent: 20,
												id: 1,
												name: 'Countertop slab',
												taxable: true,
												unit: 'sq ft',
												unitCost: 18,
											},
										],
										limit: 25,
										page: 1,
										total: 1,
									}),
								},
							},
						},
						description: 'List of cost catalog items.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List cost catalog items (VIEWER+)',
			},
			query: ListCostCatalogQuerySchema,
		}
	)
	.post(
		'/',
		({ body, set }) => {
			const validated = validateCostCatalogBody(body, set);
			if (!validated) return invalidCatalogBodyResponse();

			set.status = HTTP_STATUS.CREATED;
			return dataResponse(createCostCatalogItem(validated as CostCatalogInput));
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: CostCatalogCreateBodySchema,
			detail: {
				description:
					'Creates a reusable labor, material, subcontractor, overhead, fee, or other ' +
					'cost assumption. Requires OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Cost catalog item created', {
										active: true,
										category: 'labor',
										id: 1,
										name: 'Installer labor',
										unit: 'hour',
										unitCost: 42,
									}),
								},
							},
						},
						description: 'Cost catalog item created.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Create cost catalog item (OPERATOR+)',
			},
		}
	)
	.get(
		'/:id',
		({ params, set }) => {
			const item = getCostCatalogItem(params.id);
			if (!item) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Cost catalog item');
			}

			return dataResponse(item);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns a single catalog item, including archived items retained for existing scenarios. ' +
					'Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Cost catalog item', {
										active: true,
										category: 'overhead',
										id: 1,
										name: 'Shop overhead',
									}),
								},
							},
						},
						description: 'Cost catalog item detail.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Cost catalog item'),
				},
				summary: 'Get cost catalog item (VIEWER+)',
			},
			params: IdParamsSchema,
		}
	)
	.put(
		'/:id',
		({ body, params, set }) => {
			const validated = validateCostCatalogBody(body, set);
			if (!validated) return invalidCatalogBodyResponse();

			const item = updateCostCatalogItem(params.id, validated);
			if (!item) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Cost catalog item');
			}

			return dataResponse(item);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: CostCatalogUpdateBodySchema,
			detail: {
				description:
					'Updates catalog item defaults and active status. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Cost catalog item updated', {
										defaultMarkupPercent: 25,
										id: 1,
									}),
								},
							},
						},
						description: 'Cost catalog item updated.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Cost catalog item'),
				},
				summary: 'Update cost catalog item (OPERATOR+)',
			},
			params: IdParamsSchema,
		}
	)
	.delete(
		'/:id',
		({ params, set }) => {
			if (!archiveCostCatalogItem(params.id)) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Cost catalog item');
			}

			return successResponse();
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					'Archives a catalog item by setting active=false. Existing scenario references remain intact. ' +
					'Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: {
										summary: 'Catalog item archived',
										value: { data: null },
									},
								},
							},
						},
						description: 'Cost catalog item archived.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Cost catalog item'),
				},
				summary: 'Archive cost catalog item (OPERATOR+)',
			},
			params: IdParamsSchema,
		}
	);

export { costCatalogRoutes };

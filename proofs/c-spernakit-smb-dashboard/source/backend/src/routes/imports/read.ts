import { Elysia, t } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../constants/pagination.ts';
import {
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	paginatedExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import { getImportById, listImports } from '../../services/assetImportService.ts';
import { dataResponse, paginatedResponse } from '../../utils/apiResponse.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import { idParams, IMPORT_STATUS_SCHEMA } from './shared.ts';

/**
 * Read-only staged import routes: list batches and fetch a single batch with its
 * staged rows. Reads are VIEWER+.
 */
const importReadRoutes = new Elysia({ detail: { tags: ['Imports'] }, prefix: '/imports' })
	.use(authPlugin)
	.use(workspacePlugin)
	.get(
		'',
		({ query }) => {
			const result = listImports({
				limit: query.limit ?? DEFAULT_PAGE_LIMIT,
				page: query.page ?? DEFAULT_PAGE,
				...(query.status ? { status: query.status } : {}),
			});
			return paginatedResponse(result, result.data);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Lists staged import batches, newest first, with pagination and an optional ' +
					'status filter. Each batch records its source, row count, accepted/rejected/' +
					'warning counts, and lifecycle status. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: paginatedExample(
										'Import batches',
										[
											{
												acceptedCount: 0,
												id: 1,
												kind: 'assets',
												rowCount: 3,
												status: 'reviewing',
											},
										],
										1
									),
								},
							},
						},
						description: 'Paginated import batches.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'List import batches (VIEWER+)',
			},
			query: t.Object({
				limit: t.Optional(t.Integer({ maximum: MAX_PAGE_LIMIT, minimum: 1 })),
				page: t.Optional(t.Integer({ minimum: 1 })),
				status: t.Optional(IMPORT_STATUS_SCHEMA),
			}),
		}
	)
	.get(
		'/:id',
		({ params, set }) => {
			const result = getImportById(params.id);
			if (!result) {
				set.status = HTTP_STATUS.NOT_FOUND;
				return notFoundError('Import');
			}
			return dataResponse(result);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('VIEWER')({ set, user }),
			detail: {
				description:
					'Returns a single import batch with every staged row, ordered by source row ' +
					'number. Each row carries its raw CSV values, the parsed asset fields, its ' +
					'disposition, a human-readable message (validation notes or duplicate match), ' +
					'and — once applied — the affected asset id. Requires VIEWER role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Import detail', {
										import: { id: 1, rowCount: 3, status: 'reviewing' },
										rows: [{ id: 1, rowNumber: 1, status: 'pending' }],
									}),
								},
							},
						},
						description: 'The import batch and its staged rows.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Import'),
				},
				summary: 'Get an import batch with rows (VIEWER+)',
			},
			params: idParams,
		}
	);

export { importReadRoutes };

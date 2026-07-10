import { Elysia, t } from 'elysia';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import {
	badRequestExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	UNAUTHORIZED_EXAMPLE,
} from '../../constants/responseExamples.ts';
import { assertUser, requireRoleFresh } from '../../guards/role.ts';
import { authPlugin } from '../../plugins/auth.ts';
import { workspacePlugin } from '../../plugins/workspace.ts';
import {
	applyImport,
	createAssetImport,
	setRowDisposition,
} from '../../services/assetImportService.ts';
import { log as logAudit } from '../../services/auditService.ts';
import { dataResponse } from '../../utils/apiResponse.ts';
import { badRequestError, forbiddenError, notFoundError } from '../../utils/errorResponse.ts';
import { idParams, MAX_CSV_LENGTH, rowParams } from './shared.ts';

/**
 * Write staged import routes: stage a CSV batch, disposition individual rows,
 * and apply a batch. All write actions are OPERATOR+.
 */
const importWriteRoutes = new Elysia({ detail: { tags: ['Imports'] }, prefix: '/imports' })
	.use(authPlugin)
	.use(workspacePlugin)
	.post(
		'',
		({ body, set, user, workspaceId }) => {
			const actor = assertUser(user);
			try {
				const result = createAssetImport(
					{
						csvText: body.csv,
						...(body.notes !== undefined ? { notes: body.notes } : {}),
						...(body.source !== undefined ? { source: body.source } : {}),
					},
					actor.id,
					workspaceId
				);
				logAudit({
					action: 'ASSET_IMPORT_CREATE',
					details: {
						importId: result.import.id,
						rowCount: result.import.rowCount,
						source: result.import.source,
					},
					entityId: String(result.import.id),
					entityType: 'import',
					userId: actor.id,
				});
				set.status = HTTP_STATUS.CREATED;
				return dataResponse(result);
			} catch (err) {
				if ((err as { code?: string }).code === 'EMPTY_CSV') {
					set.status = HTTP_STATUS.BAD_REQUEST;
					return badRequestError('CSV contains no data rows');
				}
				throw err;
			}
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: t.Object({
				csv: t.String({ maxLength: MAX_CSV_LENGTH, minLength: 1 }),
				notes: t.Optional(t.String({ maxLength: 2000 })),
				source: t.Optional(t.String({ maxLength: 255 })),
			}),
			detail: {
				description:
					'Uploads a CSV document and stages it for review. Every data row is mapped to ' +
					'asset fields, validated server-side, and checked for duplicates against ' +
					'existing assets (hostname, FQDN, IP, serial number, asset tag). No asset is ' +
					'created or modified — rows are staged with a per-row disposition (pending, ' +
					'duplicate, or needs_review). Returns the batch and its staged rows. Requires ' +
					'OPERATOR role or higher.',
				responses: {
					'201': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Staged import', {
										import: { id: 1, rowCount: 3, status: 'reviewing' },
										rows: [{ id: 1, rowNumber: 1, status: 'pending' }],
									}),
								},
							},
						},
						description: 'Import staged for review.',
					},
					'400': badRequestExample('CSV contains no data rows'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
				},
				summary: 'Stage a CSV asset import (OPERATOR+)',
			},
		}
	)
	.patch(
		'/:id/rows/:rowId',
		({ body, params, set, user }) => {
			const actor = assertUser(user);
			const result = setRowDisposition(params.id, params.rowId, body.status, actor.id);
			if (!result.ok) {
				if (result.reason === 'not_found') {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError('Import row');
				}
				if (result.reason === 'closed') {
					set.status = HTTP_STATUS.CONFLICT;
					return forbiddenError(
						'This import has already been applied and can no longer be reviewed.'
					);
				}
				// not_acceptable — a row with blocking validation errors cannot be accepted.
				set.status = HTTP_STATUS.BAD_REQUEST;
				return badRequestError(
					'This row has validation errors and cannot be accepted. Reject it or fix the source data.'
				);
			}
			logAudit({
				action: 'ASSET_IMPORT_ROW_REVIEW',
				details: { disposition: body.status, importId: params.id, rowId: params.rowId },
				entityId: String(params.id),
				entityType: 'import',
				userId: actor.id,
			});
			return dataResponse(result.row);
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			body: t.Object({ status: t.Union([t.Literal('accepted'), t.Literal('rejected')]) }),
			detail: {
				description:
					'Sets a staged row to accepted or rejected. Only rows in an open (reviewing) ' +
					'batch may be re-dispositioned, and rows with blocking validation errors cannot ' +
					'be accepted. Accepting a row marks it for creation (new) or update (duplicate) ' +
					'at apply time; rejecting guarantees the row never mutates any record. Requires ' +
					'OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Row disposition set', {
										id: 1,
										status: 'accepted',
									}),
								},
							},
						},
						description: 'Updated staged row.',
					},
					'400': badRequestExample('Row cannot be accepted'),
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Import row'),
				},
				summary: 'Accept or reject a staged row (OPERATOR+)',
			},
			params: rowParams,
		}
	)
	.post(
		'/:id/apply',
		({ params, set, user }) => {
			const actor = assertUser(user);
			try {
				const result = applyImport(params.id, actor.id);
				if (!result) {
					set.status = HTTP_STATUS.NOT_FOUND;
					return notFoundError('Import');
				}
				logAudit({
					action: 'ASSET_IMPORT_APPLY',
					details: {
						acceptedCount: result.acceptedCount,
						importId: params.id,
						rejectedCount: result.rejectedCount,
						status: result.status,
					},
					entityId: String(params.id),
					entityType: 'import',
					userId: actor.id,
				});
				return dataResponse(result);
			} catch (err) {
				if ((err as { code?: string }).code === 'ALREADY_CLOSED') {
					set.status = HTTP_STATUS.CONFLICT;
					return forbiddenError('This import has already been applied.');
				}
				throw err;
			}
		},
		{
			beforeHandle: ({ set, user }) => requireRoleFresh('OPERATOR')({ set, user }),
			detail: {
				description:
					'Applies the batch: every accepted row creates a new asset or updates its ' +
					'matched duplicate, and each applied row records an `import` change event. ' +
					'Rejected, pending, and needs-review rows are never mutated. When ' +
					'`neverOverwriteNotes` is enabled, curated notes on an existing asset are ' +
					'preserved. This is a single-shot action — an already-applied batch returns ' +
					'409. Requires OPERATOR role or higher.',
				responses: {
					'200': {
						content: {
							'application/json': {
								examples: {
									success: dataExample('Import applied', {
										acceptedCount: 2,
										rejectedCount: 1,
										status: 'applied',
										warningCount: 0,
									}),
								},
							},
						},
						description: 'The import apply outcome.',
					},
					'401': UNAUTHORIZED_EXAMPLE,
					'403': FORBIDDEN_EXAMPLE,
					'404': notFoundExample('Import'),
				},
				summary: 'Apply a staged import (OPERATOR+)',
			},
			params: idParams,
		}
	);

export { importWriteRoutes };

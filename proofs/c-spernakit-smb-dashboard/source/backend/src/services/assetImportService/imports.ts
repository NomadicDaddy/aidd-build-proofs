import { and, count, desc, eq, sql } from 'drizzle-orm';

import type { PaginatedResponse } from '../../utils/dbHelpers.ts';
import type { StagedRow } from './staging.ts';
import type { ImportBatch, ImportRow, ImportWithRows } from './types.ts';

import { getDb } from '../../db/index.ts';
import { importRows, imports } from '../../db/schema/assetImports.ts';
import { paginatedQuery } from '../../utils/dbHelpers.ts';
import { parseCsv } from './csv.ts';
import { stageRow } from './staging.ts';

interface CreateImportInput {
	csvText: string;
	notes?: null | string;
	source?: null | string;
}

/**
 * Parse and stage a CSV asset import. Every data row is validated and checked
 * for duplicates, then persisted as an `import_rows` record in a `reviewing`
 * batch. No asset is created or modified here — staging only.
 *
 * @param input - The CSV document plus optional source label and notes
 * @param actorId - Id of the importing user
 * @param workspaceId - Optional workspace scope
 * @returns The created import batch with its staged rows
 * @throws Error with code 'EMPTY_CSV' when the document has no data rows
 */
function createAssetImport(
	input: CreateImportInput,
	actorId: number,
	workspaceId?: null | number
): ImportWithRows {
	const parsed = parseCsv(input.csvText);
	if (parsed.headers.length === 0 || parsed.rows.length === 0) {
		const error = new Error('CSV contains no data rows');
		(error as Error & { code?: string }).code = 'EMPTY_CSV';
		throw error;
	}

	const staged: StagedRow[] = parsed.rows.map((cells, index) => {
		const record: Record<string, string> = {};
		parsed.headers.forEach((header, col) => {
			record[header] = cells[col] ?? '';
		});
		return stageRow(record, index + 1);
	});

	const warningCount = staged.filter((r) => r.status === 'needs_review').length;

	const db = getDb();
	return db.transaction((tx) => {
		tx.insert(imports)
			.values({
				createdBy: actorId,
				importedBy: actorId,
				kind: 'assets',
				rowCount: staged.length,
				status: 'reviewing',
				updatedBy: actorId,
				warningCount,
				...(input.source !== undefined && input.source !== null
					? { source: input.source }
					: {}),
				...(input.notes !== undefined && input.notes !== null
					? { notes: input.notes }
					: {}),
				...(workspaceId !== undefined && workspaceId !== null ? { workspaceId } : {}),
			})
			.run();

		const created = tx
			.select()
			.from(imports)
			.where(eq(imports.id, sql`last_insert_rowid()`))
			.get();
		if (!created) throw new Error('Failed to retrieve import after creation');

		for (const staged_ of staged) {
			tx.insert(importRows)
				.values({
					createdBy: actorId,
					importId: created.id,
					message: staged_.message,
					parsedData: staged_.parsedData,
					rawData: staged_.rawData,
					rowNumber: staged_.rowNumber,
					status: staged_.status,
					targetAssetId: staged_.targetAssetId,
					updatedBy: actorId,
				})
				.run();
		}

		const rows = tx
			.select()
			.from(importRows)
			.where(eq(importRows.importId, created.id))
			.orderBy(importRows.rowNumber, importRows.id)
			.all();

		return { import: created, rows };
	});
}

interface ListImportsOptions {
	limit: number;
	page: number;
	status?: string | undefined;
}

/**
 * List import batches, newest first, with pagination.
 *
 * @param options - Pagination and optional status filter
 * @returns Paginated import batches
 */
function listImports(options: ListImportsOptions): PaginatedResponse<ImportBatch> {
	const db = getDb();
	const conditions = [];
	if (options.status) conditions.push(eq(imports.status, options.status));
	const where = conditions.length > 0 ? and(...conditions) : undefined;
	return paginatedQuery(
		options.page,
		options.limit,
		(limit, offset) =>
			db
				.select()
				.from(imports)
				.where(where)
				.orderBy(desc(imports.createdAt), desc(imports.id))
				.limit(limit)
				.offset(offset)
				.all(),
		() => db.select({ count: count() }).from(imports).where(where).get()
	);
}

/**
 * Get an import batch with its staged rows, ordered by source row number.
 *
 * @param id - Import id
 * @returns The batch and its rows, or null when the import does not exist
 */
function getImportById(id: number): ImportWithRows | null {
	const db = getDb();
	const batch = db.select().from(imports).where(eq(imports.id, id)).get();
	if (!batch) return null;
	const rows = db
		.select()
		.from(importRows)
		.where(eq(importRows.importId, id))
		.orderBy(importRows.rowNumber, importRows.id)
		.all();
	return { import: batch, rows };
}

/** Import batch lifecycle states that still allow review/apply actions. */
const OPEN_STATUSES = new Set<string>(['pending', 'reviewing']);

/**
 * Set a staged row's disposition to accepted or rejected. Only rows in an open
 * batch may be re-dispositioned, and rows with blocking validation errors
 * (`needs_review`) cannot be accepted.
 *
 * @param importId - Owning import id
 * @param rowId - Row id
 * @param disposition - 'accepted' or 'rejected'
 * @param actorId - Id of the reviewing user
 * @returns Result object describing the outcome
 */
function setRowDisposition(
	importId: number,
	rowId: number,
	disposition: 'accepted' | 'rejected',
	actorId: number
): { ok: false; reason: 'closed' | 'not_acceptable' | 'not_found' } | { ok: true; row: ImportRow } {
	const db = getDb();
	return db.transaction((tx) => {
		const batch = tx.select().from(imports).where(eq(imports.id, importId)).get();
		if (!batch) return { ok: false, reason: 'not_found' };
		if (!OPEN_STATUSES.has(batch.status)) return { ok: false, reason: 'closed' };

		const row = tx
			.select()
			.from(importRows)
			.where(and(eq(importRows.id, rowId), eq(importRows.importId, importId)))
			.get();
		if (!row) return { ok: false, reason: 'not_found' };

		if (disposition === 'accepted' && row.status === 'needs_review') {
			return { ok: false, reason: 'not_acceptable' };
		}

		tx.update(importRows)
			.set({ status: disposition, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(importRows.id, rowId))
			.run();

		const updated = tx.select().from(importRows).where(eq(importRows.id, rowId)).get();
		if (!updated) throw new Error('Failed to retrieve import row after update');
		return { ok: true, row: updated };
	});
}

export { createAssetImport, getImportById, listImports, OPEN_STATUSES, setRowDisposition };

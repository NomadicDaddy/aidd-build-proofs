import type { ImportKind, ImportRowStatus, ImportStatus } from 'spernakit-shared';

import type { DataResponse, PaginatedResponse } from './types';

import { apiClient } from './client';

/** A staged CSV import batch with source, counts, and lifecycle status. */
interface ImportBatch {
	acceptedCount: number;
	createdAt: string;
	id: number;
	importedBy: null | number;
	kind: ImportKind;
	notes: null | string;
	rejectedCount: number;
	rowCount: number;
	source: null | string;
	status: ImportStatus;
	updatedAt: string;
	warningCount: number;
	workspaceId: null | number;
}

/** One staged source row inside an import batch. */
interface ImportRow {
	createdAt: string;
	id: number;
	importId: number;
	message: null | string;
	parsedData: null | Record<string, unknown>;
	rawData: null | Record<string, unknown>;
	rowNumber: null | number;
	status: ImportRowStatus;
	targetAssetId: null | number;
	updatedAt: string;
}

/** An import batch together with its staged rows. */
interface ImportWithRows {
	import: ImportBatch;
	rows: ImportRow[];
}

/** Outcome of applying a staged import. */
interface ApplyImportResult {
	acceptedCount: number;
	rejectedCount: number;
	status: string;
	warningCount: number;
}

/** Body accepted when staging a new CSV import. */
interface CreateImportInput {
	csv: string;
	notes?: string;
	source?: string;
}

/** List import batches, newest first. Requires VIEWER role or higher. */
function listImports(params?: Record<string, string>): Promise<PaginatedResponse<ImportBatch>> {
	return apiClient.get<PaginatedResponse<ImportBatch>>(
		'/imports',
		params ? { params } : undefined
	);
}

/** Get a single import batch with its staged rows. Requires VIEWER role or higher. */
async function getImport(id: number): Promise<ImportWithRows> {
	const res = await apiClient.get<DataResponse<ImportWithRows>>(`/imports/${id}`);
	return res.data;
}

/** Stage a CSV document for review. Requires OPERATOR role or higher. */
async function createImport(input: CreateImportInput): Promise<ImportWithRows> {
	const res = await apiClient.post<DataResponse<ImportWithRows>>('/imports', { body: input });
	return res.data;
}

/** Accept or reject a single staged row. Requires OPERATOR role or higher. */
async function setImportRowDisposition(
	importId: number,
	rowId: number,
	status: 'accepted' | 'rejected'
): Promise<ImportRow> {
	const res = await apiClient.patch<DataResponse<ImportRow>>(
		`/imports/${importId}/rows/${rowId}`,
		{ body: { status } }
	);
	return res.data;
}

/** Apply a staged import, creating/updating assets. Requires OPERATOR role or higher. */
async function applyImport(id: number): Promise<ApplyImportResult> {
	const res = await apiClient.post<DataResponse<ApplyImportResult>>(`/imports/${id}/apply`);
	return res.data;
}

export { applyImport, createImport, getImport, listImports, setImportRowDisposition };
export type { ApplyImportResult, CreateImportInput, ImportBatch, ImportRow, ImportWithRows };

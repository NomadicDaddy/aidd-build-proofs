import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateImportInput } from '@/api/imports';

import {
	applyImport,
	createImport,
	getImport,
	listImports,
	setImportRowDisposition,
} from '@/api/imports';
import { stdCallbacks } from '@/lib/mutationHelpers';

/** Paginated list of import batches, optionally filtered by status. */
function useImports(page: number, limit: number, status?: string) {
	return useQuery({
		queryFn: () => {
			const params: Record<string, string> = { limit: String(limit), page: String(page) };
			if (status) params.status = status;
			return listImports(params);
		},
		queryKey: ['imports', page, limit, status ?? ''],
	});
}

/** A single import batch with its staged rows. */
function useImportDetail(id: number) {
	return useQuery({
		enabled: Number.isInteger(id) && id > 0,
		queryFn: () => getImport(id),
		queryKey: ['imports', id],
	});
}

/** Stage a new CSV import for review. */
function useCreateImport() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateImportInput) => createImport(input),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to stage import. Check the CSV and try again.',
			invalidateKeys: [['imports']],
			successMessage: 'CSV staged for review',
		}),
	});
}

/** Accept or reject a single staged row. */
function useReviewImportRow(importId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { rowId: number; status: 'accepted' | 'rejected' }) =>
			setImportRowDisposition(importId, input.rowId, input.status),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to update row.',
			invalidateKeys: [['imports', importId]],
			successMessage: 'Row updated',
		}),
	});
}

/** Apply a staged import: create/update assets for accepted rows. */
function useApplyImport(importId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => applyImport(importId),
		...stdCallbacks(queryClient, {
			errorMessage: 'Failed to apply import.',
			invalidateKeys: [['imports'], ['imports', importId], ['assets']],
			successMessage: 'Import applied',
		}),
	});
}

export { useApplyImport, useCreateImport, useImportDetail, useImports, useReviewImportRow };

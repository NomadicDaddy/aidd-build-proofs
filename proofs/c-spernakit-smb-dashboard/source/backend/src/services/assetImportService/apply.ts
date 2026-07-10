import { and, eq, sql } from 'drizzle-orm';

import type { ImportedAssetFields } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetChangeEvents, importRows, imports } from '../../db/schema/assetImports.ts';
import { assets } from '../../db/schema/assets.ts';
import { getInfrastructureSettings } from '../infrastructureSettingsService.ts';
import { OPEN_STATUSES } from './imports.ts';

/**
 * Coerce a stored parsedData blob into a concrete asset write payload.
 *
 * @param parsed - The row's stored parsed asset fields
 * @returns A record of asset column values suitable for insert/update
 */
function buildAssetValues(parsed: Record<string, unknown>): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const stringKeys: (keyof ImportedAssetFields)[] = [
		'name',
		'assetType',
		'status',
		'criticality',
		'description',
		'hostname',
		'fqdn',
		'primaryIp',
		'operatingSystem',
		'osVersion',
		'platform',
		'role',
		'serialNumber',
		'assetTag',
		'managementUrl',
		'documentationUrl',
		'supportContact',
		'notes',
	];
	for (const key of stringKeys) {
		const value = parsed[key];
		if (typeof value === 'string') {
			values[key] = key === 'name' ? value.trim() : value;
		}
	}
	return values;
}

interface ApplyResult {
	acceptedCount: number;
	rejectedCount: number;
	status: string;
	warningCount: number;
}

/**
 * Apply an import batch: create or update assets for every `accepted` row and
 * record an `import` change event for each. Rejected, pending, and
 * needs-review rows are never mutated. This is a single-shot operation — once a
 * batch reaches a terminal status it cannot be re-applied.
 *
 * Human-entered notes on an existing asset are preserved when the infrastructure
 * `neverOverwriteNotes` setting is enabled: the incoming notes value is dropped
 * from the update rather than overwriting the curated text.
 *
 * @param importId - Import id
 * @param actorId - Id of the applying user
 * @returns The apply outcome, or null when the import does not exist
 * @throws Error with code 'ALREADY_CLOSED' when the batch is already terminal
 */
function applyImport(importId: number, actorId: number): ApplyResult | null {
	const db = getDb();
	const { neverOverwriteNotes } = getInfrastructureSettings().importBehavior;

	return db.transaction((tx) => {
		const batch = tx.select().from(imports).where(eq(imports.id, importId)).get();
		if (!batch) return null;
		if (!OPEN_STATUSES.has(batch.status)) {
			const error = new Error('Import has already been applied');
			(error as Error & { code?: string }).code = 'ALREADY_CLOSED';
			throw error;
		}

		const rows = tx.select().from(importRows).where(eq(importRows.importId, importId)).all();

		let acceptedCount = 0;
		for (const row of rows) {
			if (row.status !== 'accepted') continue;
			const parsed = (row.parsedData ?? {}) as Record<string, unknown>;
			const values = buildAssetValues(parsed);

			// Skip a row whose target asset was deleted between staging and apply.
			const target =
				row.targetAssetId !== null
					? tx
							.select()
							.from(assets)
							.where(
								and(eq(assets.id, row.targetAssetId), eq(assets.isDeleted, false))
							)
							.get()
					: null;

			if (row.targetAssetId !== null && target) {
				const updateValues = { ...values };
				if (
					neverOverwriteNotes &&
					typeof target.notes === 'string' &&
					target.notes.length > 0
				) {
					delete updateValues.notes;
				}
				updateValues.updatedAt = new Date();
				updateValues.updatedBy = actorId;
				tx.update(assets)
					.set(updateValues as Partial<typeof assets.$inferInsert>)
					.where(eq(assets.id, row.targetAssetId))
					.run();
				recordImportEvent(tx, {
					actorId,
					assetId: row.targetAssetId,
					changes: { after: updateValues },
					importId,
					summary: `Import updated asset "${target.name}" (row ${row.rowNumber ?? '?'})`,
				});
				acceptedCount += 1;
			} else {
				const insertValues: Record<string, unknown> = {
					...values,
					createdBy: actorId,
					updatedBy: actorId,
				};
				if (batch.workspaceId !== null) insertValues.workspaceId = batch.workspaceId;
				tx.insert(assets)
					.values(insertValues as typeof assets.$inferInsert)
					.run();
				const created = tx
					.select()
					.from(assets)
					.where(eq(assets.id, sql`last_insert_rowid()`))
					.get();
				if (!created) throw new Error('Failed to retrieve asset after import create');
				tx.update(importRows)
					.set({ targetAssetId: created.id, updatedAt: new Date(), updatedBy: actorId })
					.where(eq(importRows.id, row.id))
					.run();
				recordImportEvent(tx, {
					actorId,
					assetId: created.id,
					changes: { after: insertValues },
					importId,
					summary: `Import created asset "${created.name}" (row ${row.rowNumber ?? '?'})`,
				});
				acceptedCount += 1;
			}
		}

		const rejectedCount = rows.filter((r) => r.status === 'rejected').length;
		const undecided = rows.filter(
			(r) => r.status === 'pending' || r.status === 'duplicate' || r.status === 'needs_review'
		).length;
		const warningCount = rows.filter((r) => r.status === 'needs_review').length;

		let status: string;
		if (acceptedCount === 0) {
			status = 'rejected';
		} else if (undecided > 0) {
			status = 'partial';
		} else {
			status = 'applied';
		}

		tx.update(imports)
			.set({
				acceptedCount,
				rejectedCount,
				status,
				updatedAt: new Date(),
				updatedBy: actorId,
				warningCount,
			})
			.where(eq(imports.id, importId))
			.run();

		return { acceptedCount, rejectedCount, status, warningCount };
	});
}

interface ImportEventInput {
	actorId: number;
	assetId: number;
	changes?: Record<string, unknown>;
	importId: number;
	summary: string;
}

/**
 * Append an `import` action to the asset change-event audit trail.
 *
 * @param tx - The active transaction handle
 * @param input - The change-event fields (actor, asset, import, summary, diff)
 */
function recordImportEvent(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	input: ImportEventInput
): void {
	tx.insert(assetChangeEvents)
		.values({
			action: 'import',
			actorId: input.actorId,
			assetId: input.assetId,
			entityId: input.assetId,
			entityType: 'asset',
			importId: input.importId,
			...(input.changes !== undefined ? { changes: input.changes } : {}),
			summary: input.summary,
		})
		.run();
}

export { applyImport };

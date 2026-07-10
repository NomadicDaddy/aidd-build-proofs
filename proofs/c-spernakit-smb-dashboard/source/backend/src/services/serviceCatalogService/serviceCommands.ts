import { eq, sql } from 'drizzle-orm';

import type {
	CreateServiceInput,
	ServiceResult,
	ServiceRow,
	UpdateServiceInput,
} from '../serviceCatalogQueries.ts';

import { getDb } from '../../db/index.ts';
import { serviceCatalog } from '../../db/schema/services.ts';
import { ownerExists } from '../ownerService.ts';
import { getServiceById, recordServiceEvent, serviceNameExists } from '../serviceCatalogQueries.ts';
import { buildWriteValues } from './helpers.ts';

/**
 * Create a service after validating name uniqueness and the referenced owner.
 * Records a `create` change event.
 *
 * @param input - Service fields (name required)
 * @param actorId - Id of the user performing the action
 * @param workspaceId - Optional workspace scope
 * @returns A discriminated result the route maps to an HTTP status
 */
function createService(
	input: CreateServiceInput,
	actorId: number,
	workspaceId?: null | number
): ServiceResult {
	if (serviceNameExists(input.name)) {
		return {
			error: 'conflict',
			message: `A service named "${input.name.trim()}" already exists.`,
			ok: false,
		};
	}
	if (input.ownerId !== undefined && input.ownerId !== null && !ownerExists(input.ownerId)) {
		return { error: 'validation', message: 'Owner does not exist.', ok: false };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		const values = buildWriteValues(input);
		values.createdBy = actorId;
		values.updatedBy = actorId;
		if (workspaceId !== undefined && workspaceId !== null) {
			values.workspaceId = workspaceId;
		}
		tx.insert(serviceCatalog)
			.values(values as typeof serviceCatalog.$inferInsert)
			.run();
		const created = tx
			.select()
			.from(serviceCatalog)
			.where(eq(serviceCatalog.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve service after creation');
		}
		recordServiceEvent('create', created, actorId, `Created service "${created.name}"`, {
			after: values,
		});
		return created;
	});

	return { ok: true, row };
}

/**
 * Update a service after re-validating name uniqueness (when the name changes)
 * and the referenced owner. Records an `update` change event.
 *
 * @param id - Service id
 * @param input - Fields to change
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateService(id: number, input: UpdateServiceInput, actorId: number): ServiceResult {
	const existing = getServiceById(id, false);
	if (!existing) {
		return { error: 'not_found', message: 'Service', ok: false };
	}
	if (input.name !== undefined && serviceNameExists(input.name, id)) {
		return {
			error: 'conflict',
			message: `A service named "${input.name.trim()}" already exists.`,
			ok: false,
		};
	}
	if (input.ownerId !== undefined && input.ownerId !== null && !ownerExists(input.ownerId)) {
		return { error: 'validation', message: 'Owner does not exist.', ok: false };
	}

	const changes = buildWriteValues(input);
	if (Object.keys(changes).length === 0) {
		return { ok: true, row: existing };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(serviceCatalog)
			.set({ ...changes, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(serviceCatalog.id, id))
			.run();
		const updated = tx.select().from(serviceCatalog).where(eq(serviceCatalog.id, id)).get();
		if (!updated) {
			throw new Error('Failed to retrieve service after update');
		}
		recordServiceEvent('update', updated, actorId, `Updated service "${updated.name}"`, {
			after: changes,
		});
		return updated;
	});

	return { ok: true, row };
}

/**
 * Soft-delete a service and record a `delete` change event.
 *
 * @param id - Service id
 * @param actorId - Id of the user performing the action
 * @returns The soft-deleted row, or null if not found / already deleted
 */
function softDeleteService(id: number, actorId: number): null | ServiceRow {
	const existing = getServiceById(id, false);
	if (!existing) {
		return null;
	}
	const db = getDb();
	return db.transaction((tx) => {
		tx.update(serviceCatalog)
			.set({
				deletedAt: new Date(),
				deletedBy: actorId,
				isDeleted: true,
				updatedAt: new Date(),
				updatedBy: actorId,
			})
			.where(eq(serviceCatalog.id, id))
			.run();
		const deleted = tx.select().from(serviceCatalog).where(eq(serviceCatalog.id, id)).get();
		if (!deleted) {
			throw new Error('Failed to retrieve service after delete');
		}
		recordServiceEvent('delete', deleted, actorId, `Removed service "${deleted.name}"`);
		return deleted;
	});
}

export { createService, softDeleteService, updateService };

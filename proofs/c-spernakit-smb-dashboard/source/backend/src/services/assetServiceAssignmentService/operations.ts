import type { CriticalityLevel } from 'spernakit-shared';

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type {
	AssetServiceRow,
	AssignedService,
	AssignmentResult,
	AssignmentWritableFields,
} from './shared.ts';

import { getDb } from '../../db/index.ts';
import { assetServices, serviceCatalog } from '../../db/schema/services.ts';
import {
	activeAssetExists,
	activeServiceName,
	demoteOtherPrimaries,
	recordAssignmentEvent,
	UPDATABLE_KEYS,
} from './shared.ts';

/**
 * List the services assigned to an asset, primary assignments first then by
 * service name. Soft-deleted services are excluded — a removed service no longer
 * appears in the asset's assignment list.
 *
 * @param assetId - Asset id whose service assignments to load
 * @returns The assignment rows with the service resolved to name/category/criticality
 */
function listAssignedServices(assetId: number): AssignedService[] {
	const db = getDb();
	return db
		.select({
			assignmentId: assetServices.id,
			isPrimary: assetServices.isPrimary,
			notes: assetServices.notes,
			role: assetServices.role,
			serviceCategory: serviceCatalog.category,
			serviceCriticality: serviceCatalog.criticality,
			serviceId: assetServices.serviceId,
			serviceName: serviceCatalog.name,
		})
		.from(assetServices)
		.innerJoin(serviceCatalog, eq(assetServices.serviceId, serviceCatalog.id))
		.where(and(eq(assetServices.assetId, assetId), eq(serviceCatalog.isDeleted, false)))
		.orderBy(desc(assetServices.isPrimary), asc(serviceCatalog.name))
		.all()
		.map((r) => ({
			assignmentId: r.assignmentId,
			isPrimary: r.isPrimary,
			notes: r.notes,
			role: r.role,
			serviceCategory: r.serviceCategory,
			serviceCriticality: (r.serviceCriticality as CriticalityLevel | null) ?? null,
			serviceId: r.serviceId,
			serviceName: r.serviceName,
		}));
}

/**
 * Get a single assignment scoped to its owning asset.
 *
 * @param assetId - Owning asset id
 * @param assignmentId - Assignment id
 * @returns The assignment row, or null when it does not belong to the asset
 */
function getAssignment(assetId: number, assignmentId: number): AssetServiceRow | null {
	const db = getDb();
	return (
		db
			.select()
			.from(assetServices)
			.where(and(eq(assetServices.id, assignmentId), eq(assetServices.assetId, assetId)))
			.get() ?? null
	);
}

/**
 * Assign a catalog service to an asset with an optional role label. Validates
 * the asset and service both exist and are active, and that the service is not
 * already assigned to the asset. Records a `create` change event on the asset
 * trail. Setting isPrimary demotes any other asset marked primary for the same
 * service.
 *
 * @param assetId - Asset id the service is assigned to
 * @param input - Assignment fields (serviceId required)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function createServiceAssignment(
	assetId: number,
	input: AssignmentWritableFields,
	actorId: number
): AssignmentResult {
	if (!activeAssetExists(assetId)) {
		return { error: 'not_found', message: 'Asset', ok: false };
	}
	if (input.serviceId === undefined) {
		return { error: 'validation', message: 'A service is required.', ok: false };
	}
	const serviceName = activeServiceName(input.serviceId);
	if (serviceName === null) {
		return { error: 'not_found', message: 'Service', ok: false };
	}

	const db = getDb();
	const existing = db
		.select({ id: assetServices.id })
		.from(assetServices)
		.where(
			and(eq(assetServices.assetId, assetId), eq(assetServices.serviceId, input.serviceId))
		)
		.get();
	if (existing) {
		return {
			error: 'conflict',
			message: `"${serviceName}" is already assigned to this asset.`,
			ok: false,
		};
	}

	const row = db.transaction((tx) => {
		tx.insert(assetServices)
			.values({
				assetId,
				createdBy: actorId,
				isPrimary: input.isPrimary ?? false,
				notes: input.notes ?? null,
				role: input.role ?? null,
				serviceId: input.serviceId!,
				updatedBy: actorId,
			})
			.run();
		const created = tx
			.select()
			.from(assetServices)
			.where(eq(assetServices.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve service assignment after creation');
		}
		if (created.isPrimary) {
			demoteOtherPrimaries(tx, created.serviceId, created.id);
		}
		recordAssignmentEvent(
			'create',
			created,
			actorId,
			`Assigned service "${serviceName}"${created.role ? ` as ${created.role}` : ''}`,
			{
				after: {
					isPrimary: created.isPrimary,
					role: created.role,
					serviceId: created.serviceId,
				},
			}
		);
		return created;
	});

	return { ok: true, row };
}

/**
 * Update an asset's service assignment — its role label, primary flag, or notes.
 * The target service cannot be changed (delete and re-assign instead). Validates
 * the assignment belongs to the asset. Records an `update` change event and
 * preserves the single-primary-per-service invariant.
 *
 * @param assetId - Owning asset id
 * @param assignmentId - Assignment id to update
 * @param input - Fields to change (undefined skipped, null clears text columns)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function updateServiceAssignment(
	assetId: number,
	assignmentId: number,
	input: AssignmentWritableFields,
	actorId: number
): AssignmentResult {
	const existing = getAssignment(assetId, assignmentId);
	if (!existing) {
		return { error: 'not_found', message: 'Service assignment', ok: false };
	}

	const values: Record<string, unknown> = {};
	for (const key of UPDATABLE_KEYS) {
		const value = input[key];
		if (value !== undefined) values[key] = value;
	}
	if (Object.keys(values).length === 0) {
		return { ok: true, row: existing };
	}

	const serviceName = activeServiceName(existing.serviceId) ?? `#${existing.serviceId}`;
	const db = getDb();
	const row = db.transaction((tx) => {
		tx.update(assetServices)
			.set({ ...values, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(assetServices.id, assignmentId))
			.run();
		const updated = tx
			.select()
			.from(assetServices)
			.where(eq(assetServices.id, assignmentId))
			.get();
		if (!updated) {
			throw new Error('Failed to retrieve service assignment after update');
		}
		if (updated.isPrimary) {
			demoteOtherPrimaries(tx, updated.serviceId, updated.id);
		}
		const before: Record<string, unknown> = {};
		for (const key of Object.keys(values)) {
			before[key] = (existing as Record<string, unknown>)[key];
		}
		recordAssignmentEvent(
			'update',
			updated,
			actorId,
			`Updated the "${serviceName}" service assignment`,
			{ after: values, before }
		);
		return updated;
	});

	return { ok: true, row };
}

/**
 * Remove a service assignment from an asset and record a `delete` change event.
 * Assignments are hard-deleted (they carry no soft-delete columns).
 *
 * @param assetId - Owning asset id
 * @param assignmentId - Assignment id to delete
 * @param actorId - Id of the user performing the action
 * @returns The removed row, or null when it does not belong to the asset
 */
function deleteServiceAssignment(
	assetId: number,
	assignmentId: number,
	actorId: number
): AssetServiceRow | null {
	const existing = getAssignment(assetId, assignmentId);
	if (!existing) {
		return null;
	}
	const serviceName = activeServiceName(existing.serviceId) ?? `#${existing.serviceId}`;

	const db = getDb();
	db.transaction((tx) => {
		tx.delete(assetServices).where(eq(assetServices.id, assignmentId)).run();
		recordAssignmentEvent('delete', existing, actorId, `Unassigned service "${serviceName}"`);
	});

	return existing;
}

export {
	createServiceAssignment,
	deleteServiceAssignment,
	getAssignment,
	listAssignedServices,
	updateServiceAssignment,
};

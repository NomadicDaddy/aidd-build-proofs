import { and, eq, sql } from 'drizzle-orm';

import type {
	CreateDependencyInput,
	DependencyResult,
	ServiceDependencyRow,
} from '../serviceCatalogQueries.ts';

import { getDb } from '../../db/index.ts';
import { serviceDependencies } from '../../db/schema/services.ts';
import { getServiceById, recordServiceEvent } from '../serviceCatalogQueries.ts';
import { activeAssetExists } from './helpers.ts';

/**
 * Add a dependency from a service onto exactly one target — another service or
 * an infrastructure asset. Validates the parent service, the exclusivity of the
 * target, no self-dependency, and the target's existence. Records an `update`
 * change event against the dependent service.
 *
 * @param serviceId - The dependent service's id
 * @param input - The dependency fields (exactly one target id required)
 * @param actorId - Id of the user performing the action
 * @returns A discriminated result the route maps to an HTTP status
 */
function addServiceDependency(
	serviceId: number,
	input: CreateDependencyInput,
	actorId: number
): DependencyResult {
	const service = getServiceById(serviceId, false);
	if (!service) {
		return { error: 'not_found', message: 'Service', ok: false };
	}

	const hasService = input.dependsOnServiceId !== undefined && input.dependsOnServiceId !== null;
	const hasAsset = input.dependsOnAssetId !== undefined && input.dependsOnAssetId !== null;
	if (hasService === hasAsset) {
		return {
			error: 'validation',
			message: 'A dependency must target exactly one service or asset.',
			ok: false,
		};
	}

	if (hasService) {
		if (input.dependsOnServiceId === serviceId) {
			return {
				error: 'validation',
				message: 'A service cannot depend on itself.',
				ok: false,
			};
		}
		if (!getServiceById(input.dependsOnServiceId!, false)) {
			return { error: 'not_found', message: 'Target service', ok: false };
		}
	} else if (!activeAssetExists(input.dependsOnAssetId!)) {
		return { error: 'not_found', message: 'Target asset', ok: false };
	}

	const db = getDb();
	const row = db.transaction((tx) => {
		const values: typeof serviceDependencies.$inferInsert = {
			createdBy: actorId,
			dependencyType: input.dependencyType ?? null,
			dependsOnAssetId: hasAsset ? input.dependsOnAssetId! : null,
			dependsOnServiceId: hasService ? input.dependsOnServiceId! : null,
			notes: input.notes ?? null,
			serviceId,
			updatedBy: actorId,
		};
		tx.insert(serviceDependencies).values(values).run();
		const created = tx
			.select()
			.from(serviceDependencies)
			.where(eq(serviceDependencies.id, sql`last_insert_rowid()`))
			.get();
		if (!created) {
			throw new Error('Failed to retrieve dependency after creation');
		}
		recordServiceEvent(
			'update',
			service,
			actorId,
			`Added a dependency to service "${service.name}"`,
			{ after: values }
		);
		return created;
	});

	return { ok: true, row };
}

/**
 * Remove a dependency from a service. The dependency must belong to the given
 * service. Records an `update` change event against the service.
 *
 * @param serviceId - The dependent service's id
 * @param dependencyId - The dependency edge id
 * @param actorId - Id of the user performing the action
 * @returns The removed row, or null when the dependency is not found on the service
 */
function removeServiceDependency(
	serviceId: number,
	dependencyId: number,
	actorId: number
): null | ServiceDependencyRow {
	const db = getDb();
	const existing = db
		.select()
		.from(serviceDependencies)
		.where(
			and(
				eq(serviceDependencies.id, dependencyId),
				eq(serviceDependencies.serviceId, serviceId)
			)
		)
		.get();
	if (!existing) {
		return null;
	}
	const service = getServiceById(serviceId, true);
	return db.transaction((tx) => {
		tx.delete(serviceDependencies).where(eq(serviceDependencies.id, dependencyId)).run();
		if (service) {
			recordServiceEvent(
				'update',
				service,
				actorId,
				`Removed a dependency from service "${service.name}"`
			);
		}
		return existing;
	});
}

export { addServiceDependency, removeServiceDependency };

import type { AssetType, CriticalityLevel } from 'spernakit-shared';

import { and, count, desc, eq, inArray, or } from 'drizzle-orm';

import type { PaginatedResponse } from '../../utils/dbHelpers.ts';
import type {
	BackingAsset,
	EnrichedServiceRow,
	ListServicesOptions,
	ResolvedDependency,
	ServiceDetail,
	ServiceRow,
} from './types.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';
import { owners, vendors } from '../../db/schema/infrastructure.ts';
import { assetServices, serviceCatalog, serviceDependencies } from '../../db/schema/services.ts';
import { escapeLikePattern, likeEscaped, paginatedQuery } from '../../utils/dbHelpers.ts';
import { getServiceById } from './helpers.ts';

/**
 * List services with pagination and filtering. Only active services are
 * returned unless includeDeleted is set.
 *
 * @param options - Pagination and filter options
 * @returns Paginated service rows, newest first
 */
function listServices(options: ListServicesOptions): PaginatedResponse<ServiceRow> {
	const db = getDb();
	const conditions = [];

	if (!options.includeDeleted) {
		conditions.push(eq(serviceCatalog.isDeleted, false));
	}
	if (options.workspaceScope !== undefined && options.workspaceScope !== null) {
		conditions.push(eq(serviceCatalog.workspaceId, options.workspaceScope));
	}
	if (options.category) {
		conditions.push(eq(serviceCatalog.category, options.category));
	}
	if (options.criticality) {
		conditions.push(eq(serviceCatalog.criticality, options.criticality));
	}
	if (options.ownerId !== undefined) {
		conditions.push(eq(serviceCatalog.ownerId, options.ownerId));
	}
	if (options.search) {
		const pattern = `%${escapeLikePattern(options.search)}%`;
		conditions.push(
			or(
				likeEscaped(serviceCatalog.name, pattern),
				likeEscaped(serviceCatalog.category, pattern),
				likeEscaped(serviceCatalog.description, pattern)
			)!
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return paginatedQuery(
		options.page,
		options.limit,
		(limit, offset) =>
			db
				.select()
				.from(serviceCatalog)
				.where(where)
				.orderBy(desc(serviceCatalog.createdAt))
				.limit(limit)
				.offset(offset)
				.all(),
		() => db.select({ count: count() }).from(serviceCatalog).where(where).get()
	);
}

/**
 * Resolve owner/vendor names and backing-asset counts for a page of service
 * rows in a small number of batched lookups, returning enriched copies.
 *
 * @param rows - The service rows to enrich
 * @returns The rows with owner/vendor names and backing-asset counts attached
 */
function enrichServiceRows(rows: ServiceRow[]): EnrichedServiceRow[] {
	if (rows.length === 0) {
		return [];
	}
	const db = getDb();

	const ownerIds = [
		...new Set(rows.map((r) => r.ownerId).filter((v): v is number => v !== null)),
	];
	const ownerNames = new Map<number, string>();
	if (ownerIds.length > 0) {
		for (const o of db
			.select({ id: owners.id, name: owners.name })
			.from(owners)
			.where(inArray(owners.id, ownerIds))
			.all()) {
			ownerNames.set(o.id, o.name);
		}
	}

	const vendorIds = [
		...new Set(rows.map((r) => r.vendorId).filter((v): v is number => v !== null)),
	];
	const vendorNames = new Map<number, string>();
	if (vendorIds.length > 0) {
		for (const v of db
			.select({ id: vendors.id, name: vendors.name })
			.from(vendors)
			.where(inArray(vendors.id, vendorIds))
			.all()) {
			vendorNames.set(v.id, v.name);
		}
	}

	const serviceIds = rows.map((r) => r.id);
	const countsByService = new Map<number, number>();
	for (const c of db
		.select({ n: count(), serviceId: assetServices.serviceId })
		.from(assetServices)
		.where(inArray(assetServices.serviceId, serviceIds))
		.groupBy(assetServices.serviceId)
		.all()) {
		countsByService.set(c.serviceId, c.n);
	}

	return rows.map((row) => ({
		...row,
		backingAssetCount: countsByService.get(row.id) ?? 0,
		ownerName: row.ownerId === null ? null : (ownerNames.get(row.ownerId) ?? null),
		vendorName: row.vendorId === null ? null : (vendorNames.get(row.vendorId) ?? null),
	}));
}

/**
 * List services with owner/vendor names and backing-asset counts resolved.
 * Same filtering/pagination contract as {@link listServices}.
 *
 * @param options - Pagination and filter options
 * @returns Paginated enriched service rows, newest first
 */
function listServicesEnriched(options: ListServicesOptions): PaginatedResponse<EnrichedServiceRow> {
	const page = listServices(options);
	return { ...page, data: enrichServiceRows(page.data) };
}

/**
 * List the assets that back a service, primary assignments first. Soft-deleted
 * assets are excluded — a decommissioned host no longer backs the service.
 *
 * @param serviceId - Service id
 * @returns The backing-asset rows with the asset resolved to name/type
 */
function listBackingAssets(serviceId: number): BackingAsset[] {
	const db = getDb();
	return db
		.select({
			assetId: assetServices.assetId,
			assetType: assets.assetType,
			assignmentId: assetServices.id,
			criticality: assets.criticality,
			isPrimary: assetServices.isPrimary,
			name: assets.name,
			role: assetServices.role,
		})
		.from(assetServices)
		.innerJoin(assets, eq(assetServices.assetId, assets.id))
		.where(and(eq(assetServices.serviceId, serviceId), eq(assets.isDeleted, false)))
		.orderBy(desc(assetServices.isPrimary), assetServices.id)
		.all()
		.map((r) => ({
			assetId: r.assetId,
			assetType: (r.assetType as AssetType | null) ?? null,
			assignmentId: r.assignmentId,
			criticality: (r.criticality as CriticalityLevel | null) ?? null,
			isPrimary: r.isPrimary,
			name: r.name,
			role: r.role,
		}));
}

/**
 * List a service's dependencies with each target (another service or an asset)
 * resolved to a display name.
 *
 * @param serviceId - The dependent service's id
 * @returns The dependency edges, newest first, with target names resolved
 */
function listServiceDependencies(serviceId: number): ResolvedDependency[] {
	const db = getDb();
	const rows = db
		.select()
		.from(serviceDependencies)
		.where(eq(serviceDependencies.serviceId, serviceId))
		.orderBy(desc(serviceDependencies.createdAt))
		.all();
	if (rows.length === 0) {
		return [];
	}

	const svcIds = [
		...new Set(rows.map((r) => r.dependsOnServiceId).filter((v): v is number => v !== null)),
	];
	const svcNames = new Map<number, string>();
	if (svcIds.length > 0) {
		for (const s of db
			.select({ id: serviceCatalog.id, name: serviceCatalog.name })
			.from(serviceCatalog)
			.where(inArray(serviceCatalog.id, svcIds))
			.all()) {
			svcNames.set(s.id, s.name);
		}
	}

	const assetIds = [
		...new Set(rows.map((r) => r.dependsOnAssetId).filter((v): v is number => v !== null)),
	];
	const assetById = new Map<number, { name: string; type: string }>();
	if (assetIds.length > 0) {
		for (const a of db
			.select({ id: assets.id, name: assets.name, type: assets.assetType })
			.from(assets)
			.where(inArray(assets.id, assetIds))
			.all()) {
			assetById.set(a.id, { name: a.name, type: a.type });
		}
	}

	return rows.map((row) => {
		const asset =
			row.dependsOnAssetId === null ? undefined : assetById.get(row.dependsOnAssetId);
		return {
			...row,
			dependsOnAssetName: asset?.name ?? null,
			dependsOnAssetType: (asset?.type as AssetType | undefined) ?? null,
			dependsOnServiceName:
				row.dependsOnServiceId === null
					? null
					: (svcNames.get(row.dependsOnServiceId) ?? null),
		};
	});
}

/**
 * Assemble the full detail payload for a service: the enriched record plus its
 * backing assets and resolved dependencies.
 *
 * @param id - Service id
 * @param includeDeleted - When true, a soft-deleted service still resolves
 * @param workspaceScope - When set, the service must belong to this workspace or
 *   null is returned; used to enforce workspace boundaries on single-record reads
 * @returns The service detail, or null when the service does not exist
 */
function getServiceDetail(
	id: number,
	includeDeleted = false,
	workspaceScope: null | number = null
): null | ServiceDetail {
	const row = getServiceById(id, includeDeleted, workspaceScope);
	if (!row) {
		return null;
	}
	const [enriched] = enrichServiceRows([row]);
	return {
		...enriched!,
		backingAssets: listBackingAssets(id),
		dependencies: listServiceDependencies(id),
	};
}

export {
	enrichServiceRows,
	getServiceDetail,
	listBackingAssets,
	listServiceDependencies,
	listServices,
	listServicesEnriched,
};

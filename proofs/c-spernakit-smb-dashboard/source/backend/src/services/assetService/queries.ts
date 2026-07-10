import type { SQL } from 'drizzle-orm';

import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm';

import type { PaginatedResponse } from '../../utils/dbHelpers.ts';
import type { AssetRow, ListAssetsOptions } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';
import { assetPorts } from '../../db/schema/services.ts';
import { escapeLikePattern, likeEscaped, paginatedQuery } from '../../utils/dbHelpers.ts';

/**
 * Build the `asset_ports` sub-conditions from the port-based list filters, or
 * return null when no port filter is set. Assets are matched when they have at
 * least one port satisfying every supplied condition (protocol, port number,
 * exposure level, review state, and owning service).
 *
 * @param options - The list options carrying the port filter fields
 * @returns The port filter conditions, or null when none apply
 */
function portFilterConditions(options: ListAssetsOptions): null | SQL[] {
	const conditions: SQL[] = [];
	if (options.protocol) conditions.push(eq(assetPorts.protocol, options.protocol));
	if (options.portNumber !== undefined) {
		conditions.push(eq(assetPorts.portNumber, options.portNumber));
	}
	if (options.exposureLevel) conditions.push(eq(assetPorts.exposureLevel, options.exposureLevel));
	if (options.portReviewState) {
		conditions.push(eq(assetPorts.reviewState, options.portReviewState));
	}
	if (options.portServiceId !== undefined) {
		conditions.push(eq(assetPorts.serviceId, options.portServiceId));
	}
	return conditions.length > 0 ? conditions : null;
}

/**
 * Check whether an active (non-deleted) asset already uses the given name.
 * Comparison is case-insensitive and dialect-portable (lower()).
 *
 * @param name - Candidate asset name
 * @param excludeId - Asset id to ignore (used when renaming an existing asset)
 * @returns True if another active asset already has the name
 */
function assetNameExists(name: string, excludeId?: number): boolean {
	const db = getDb();
	const conditions = [
		eq(sql`lower(${assets.name})`, name.trim().toLowerCase()),
		eq(assets.isDeleted, false),
	];
	if (excludeId !== undefined) {
		conditions.push(sql`${assets.id} <> ${excludeId}`);
	}
	const row = db
		.select({ id: assets.id })
		.from(assets)
		.where(and(...conditions))
		.get();
	return row !== undefined;
}

/**
 * List assets with pagination and rich filtering.
 *
 * By default only active (non-deleted) assets are returned; pass
 * `includeDeleted` to include soft-deleted records.
 *
 * @param options - Pagination and filter options
 * @returns Paginated asset rows, newest first
 */
function listAssets(options: ListAssetsOptions): PaginatedResponse<AssetRow> {
	const db = getDb();

	const conditions = [];

	if (!options.includeDeleted) {
		conditions.push(eq(assets.isDeleted, false));
	}
	if (options.workspaceScope !== undefined && options.workspaceScope !== null) {
		conditions.push(eq(assets.workspaceId, options.workspaceScope));
	}
	if (options.type) {
		conditions.push(eq(assets.assetType, options.type));
	}
	if (options.status) {
		conditions.push(eq(assets.status, options.status));
	}
	if (options.criticality) {
		conditions.push(eq(assets.criticality, options.criticality));
	}
	if (options.siteId !== undefined) {
		conditions.push(eq(assets.siteId, options.siteId));
	}
	if (options.ownerId !== undefined) {
		conditions.push(
			or(
				eq(assets.businessOwnerId, options.ownerId),
				eq(assets.technicalOwnerId, options.ownerId)
			)!
		);
	}
	if (options.role) {
		conditions.push(likeEscaped(assets.role, `%${escapeLikePattern(options.role)}%`));
	}
	if (options.operatingSystem) {
		conditions.push(
			likeEscaped(assets.operatingSystem, `%${escapeLikePattern(options.operatingSystem)}%`)
		);
	}
	if (options.ip) {
		conditions.push(likeEscaped(assets.primaryIp, `%${escapeLikePattern(options.ip)}%`));
	}
	if (options.virtual !== undefined) {
		conditions.push(eq(assets.isVirtual, options.virtual));
	}
	if (options.search) {
		const pattern = `%${escapeLikePattern(options.search)}%`;
		conditions.push(
			or(
				likeEscaped(assets.name, pattern),
				likeEscaped(assets.hostname, pattern),
				likeEscaped(assets.fqdn, pattern),
				likeEscaped(assets.primaryIp, pattern)
			)!
		);
	}
	// Port-based filters (protocol, port number, exposure, review state, owning
	// service) match an asset when it has at least one port satisfying them all.
	const portConditions = portFilterConditions(options);
	if (portConditions) {
		conditions.push(
			inArray(
				assets.id,
				db
					.select({ assetId: assetPorts.assetId })
					.from(assetPorts)
					.where(and(...portConditions))
			)
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return paginatedQuery(
		options.page,
		options.limit,
		(limit, offset) =>
			db
				.select()
				.from(assets)
				.where(where)
				.orderBy(desc(assets.createdAt))
				.limit(limit)
				.offset(offset)
				.all(),
		() => db.select({ count: count() }).from(assets).where(where).get()
	);
}

/**
 * Get a single asset by id.
 *
 * @param id - Asset id
 * @param includeDeleted - When true, soft-deleted assets are returned too
 * @param workspaceScope - When set, the asset must belong to this workspace or
 *   null is returned; used to enforce workspace boundaries on single-record reads
 * @returns The asset row, or null if not found (or deleted and not included)
 */
function getAssetById(
	id: number,
	includeDeleted = false,
	workspaceScope: null | number = null
): AssetRow | null {
	const db = getDb();
	const conditions = [eq(assets.id, id)];
	if (!includeDeleted) {
		conditions.push(eq(assets.isDeleted, false));
	}
	if (workspaceScope !== null) {
		conditions.push(eq(assets.workspaceId, workspaceScope));
	}
	return (
		db
			.select()
			.from(assets)
			.where(and(...conditions))
			.get() ?? null
	);
}

export { assetNameExists, getAssetById, listAssets };

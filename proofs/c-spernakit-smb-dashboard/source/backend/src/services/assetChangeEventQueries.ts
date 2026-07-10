import { and, count, desc, eq, gte, lte } from 'drizzle-orm';

import { getDb } from '../db/index.ts';
import { assetChangeEvents } from '../db/schema/assetImports.ts';
import { users } from '../db/schema/users.ts';
import { paginatedQuery } from '../utils/dbHelpers.ts';

/**
 * A single asset change-event as surfaced to the API: the raw
 * `asset_change_events` row plus the resolved actor username (via left join on
 * users), with the timestamp serialized to ISO-8601.
 */
interface ChangeEventEntry {
	action: string;
	actorId: null | number;
	actorUsername: null | string;
	assetId: null | number;
	changes: null | Record<string, unknown>;
	createdAt: string;
	entityId: null | number;
	entityType: string;
	id: number;
	importId: null | number;
	summary: null | string;
}

/** Pagination and filter options for the change-event audit trail. */
interface ListChangeEventsOptions {
	action?: string | undefined;
	actorId?: number | undefined;
	assetId?: number | undefined;
	dateFrom?: string | undefined;
	dateTo?: string | undefined;
	entityType?: string | undefined;
	limit: number;
	page: number;
}

/**
 * List asset change events with pagination and filtering, newest first. Every
 * write to the asset domain (asset and relationship create/update/delete/
 * restore/archive/import) appends a row here; this is the read side that powers
 * both the per-asset history section and the filterable audit report.
 *
 * @param options - Pagination and filter options
 * @returns Paginated change-event entries with the actor username resolved
 */
function listAssetChangeEvents(options: ListChangeEventsOptions): {
	data: ChangeEventEntry[];
	limit: number;
	page: number;
	total: number;
} {
	const db = getDb();
	const conditions = [];

	if (options.assetId !== undefined) {
		conditions.push(eq(assetChangeEvents.assetId, options.assetId));
	}
	if (options.action) {
		conditions.push(eq(assetChangeEvents.action, options.action));
	}
	if (options.entityType) {
		conditions.push(eq(assetChangeEvents.entityType, options.entityType));
	}
	if (options.actorId !== undefined) {
		conditions.push(eq(assetChangeEvents.actorId, options.actorId));
	}
	if (options.dateFrom) {
		conditions.push(gte(assetChangeEvents.createdAt, new Date(options.dateFrom)));
	}
	if (options.dateTo) {
		conditions.push(lte(assetChangeEvents.createdAt, new Date(options.dateTo)));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	return paginatedQuery(
		options.page,
		options.limit,
		(limitNum, offset) => {
			const rows = db
				.select({
					action: assetChangeEvents.action,
					actorId: assetChangeEvents.actorId,
					actorUsername: users.username,
					assetId: assetChangeEvents.assetId,
					changes: assetChangeEvents.changes,
					createdAt: assetChangeEvents.createdAt,
					entityId: assetChangeEvents.entityId,
					entityType: assetChangeEvents.entityType,
					id: assetChangeEvents.id,
					importId: assetChangeEvents.importId,
					summary: assetChangeEvents.summary,
				})
				.from(assetChangeEvents)
				.leftJoin(users, eq(assetChangeEvents.actorId, users.id))
				.where(whereClause)
				.orderBy(desc(assetChangeEvents.createdAt), desc(assetChangeEvents.id))
				.limit(limitNum)
				.offset(offset)
				.all();

			return rows.map((row) => ({
				action: row.action,
				actorId: row.actorId,
				actorUsername: row.actorUsername,
				assetId: row.assetId,
				changes: row.changes ?? null,
				createdAt: row.createdAt.toISOString(),
				entityId: row.entityId,
				entityType: row.entityType,
				id: row.id,
				importId: row.importId,
				summary: row.summary,
			}));
		},
		() => db.select({ count: count() }).from(assetChangeEvents).where(whereClause).get()
	);
}

export type { ChangeEventEntry, ListChangeEventsOptions };
export { listAssetChangeEvents };

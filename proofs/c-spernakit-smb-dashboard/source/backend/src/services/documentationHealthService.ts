import type { SQL } from 'drizzle-orm';
import type { DocumentationHealthSignal } from 'spernakit-shared';

import { and, asc, count, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { DEFAULT_STALE_THRESHOLD_DAYS, DOCUMENTATION_HEALTH_SIGNALS } from 'spernakit-shared';

import type { PaginatedResponse } from '../utils/dbHelpers.ts';

import { getDb } from '../db/index.ts';
import { assetRelationships } from '../db/schema/assetRelationships.ts';
import { assets } from '../db/schema/assets.ts';
import { assetPorts, assetServices } from '../db/schema/services.ts';
import { paginatedQuery } from '../utils/dbHelpers.ts';

type AssetRow = typeof assets.$inferSelect;

const MS_PER_DAY = 86_400_000;

/** Per-signal asset counts plus the threshold and total used to compute them. */
interface DocumentationHealthSummary {
	signals: Record<DocumentationHealthSignal, number>;
	thresholdDays: number;
	totalAssets: number;
}

// Coerce a nullable SQLite aggregate (returned as string | null) to a number.
function toNumber(value: null | number | string | undefined): number {
	if (value === null || value === undefined) return 0;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build the SQL predicate identifying assets that exhibit a documentation-health
 * gap. Each predicate is expressed over the `assets` table and is safe to combine
 * with the not-deleted base filter for both counts and paginated list views.
 *
 * @param signal - Which documentation gap to test for
 * @param staleBefore - Assets last verified before this instant count as stale
 * @returns A Drizzle SQL condition selecting the gapped assets
 */
function signalCondition(signal: DocumentationHealthSignal, staleBefore: Date): SQL {
	switch (signal) {
		case 'missingBackup':
			// No active outgoing backs_up_to edge → backup destination undocumented.
			return sql`${assets.id} not in (select ${assetRelationships.sourceAssetId} from ${assetRelationships} where ${assetRelationships.isDeleted} = 0 and ${assetRelationships.relationshipType} = 'backs_up_to')`;
		case 'missingOwner':
			// Neither a business nor a technical owner is recorded.
			return and(isNull(assets.businessOwnerId), isNull(assets.technicalOwnerId))!;
		case 'missingRelationshipMap':
			// Appears as neither source nor target of any active relationship.
			return sql`${assets.id} not in (select ${assetRelationships.sourceAssetId} from ${assetRelationships} where ${assetRelationships.isDeleted} = 0) and ${assets.id} not in (select ${assetRelationships.targetAssetId} from ${assetRelationships} where ${assetRelationships.isDeleted} = 0)`;
		case 'missingServiceRole':
			// No documented role and no service assignment describing its function.
			return and(
				or(isNull(assets.role), eq(sql`trim(${assets.role})`, '')),
				sql`${assets.id} not in (select ${assetServices.assetId} from ${assetServices})`
			)!;
		case 'stale':
			// Never verified, or last verified before the stale threshold.
			return or(isNull(assets.lastVerifiedAt), lt(assets.lastVerifiedAt, staleBefore))!;
		case 'unverifiedPorts':
			// Has at least one port that was never verified or still needs review.
			return sql`${assets.id} in (select ${assetPorts.assetId} from ${assetPorts} where ${assetPorts.verifiedAt} is null or ${assetPorts.reviewState} = 'needs_review')`;
	}
}

// Instant before which an asset's lastVerifiedAt is considered stale.
function staleCutoff(thresholdDays: number): Date {
	return new Date(Date.now() - thresholdDays * MS_PER_DAY);
}

// Count non-deleted assets matching a signal's gap predicate.
function countForSignal(signal: DocumentationHealthSignal, staleBefore: Date): number {
	const db = getDb();
	return toNumber(
		db
			.select({ total: count() })
			.from(assets)
			.where(and(eq(assets.isDeleted, false), signalCondition(signal, staleBefore)))
			.get()?.total
	);
}

/**
 * Compute the documentation-health summary: how many live assets exhibit each
 * completeness gap, evaluated against a configurable stale-data threshold.
 *
 * @param thresholdDays - Stale-data threshold in days (defaults to the shared default)
 * @returns Per-signal counts plus the effective threshold and total asset count
 */
function getDocumentationHealthSummary(
	thresholdDays: number = DEFAULT_STALE_THRESHOLD_DAYS
): DocumentationHealthSummary {
	const db = getDb();
	const staleBefore = staleCutoff(thresholdDays);
	const totalAssets = toNumber(
		db.select({ total: count() }).from(assets).where(eq(assets.isDeleted, false)).get()?.total
	);

	const signals = {} as Record<DocumentationHealthSignal, number>;
	for (const signal of DOCUMENTATION_HEALTH_SIGNALS) {
		signals[signal] = countForSignal(signal, staleBefore);
	}

	return { signals, thresholdDays, totalAssets };
}

interface ListForSignalOptions {
	limit: number;
	page: number;
	signal: DocumentationHealthSignal;
	thresholdDays?: number;
}

/**
 * List the live assets that exhibit a given documentation-health gap, paginated
 * and ordered by name. Powers the drill-in "filterable list view" for a signal.
 *
 * @param options - Signal, pagination, and stale threshold
 * @returns Paginated asset rows matching the signal, ordered by name
 */
function listAssetsForSignal(options: ListForSignalOptions): PaginatedResponse<AssetRow> {
	const db = getDb();
	const staleBefore = staleCutoff(options.thresholdDays ?? DEFAULT_STALE_THRESHOLD_DAYS);
	const where = and(eq(assets.isDeleted, false), signalCondition(options.signal, staleBefore));

	return paginatedQuery(
		options.page,
		options.limit,
		(limit, offset) =>
			db
				.select()
				.from(assets)
				.where(where)
				.orderBy(asc(assets.name))
				.limit(limit)
				.offset(offset)
				.all(),
		() => db.select({ count: count() }).from(assets).where(where).get()
	);
}

export { getDocumentationHealthSummary, listAssetsForSignal };
export type { DocumentationHealthSummary };

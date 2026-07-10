import { asc, eq } from 'drizzle-orm';

import type { UserRole } from '../../types/roles.ts';
import type { PaginatedResponse } from '../../utils/dbHelpers.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';
import { assetPorts } from '../../db/schema/services.ts';
import { listAssets } from '../assetService.ts';
import { redactAssetForRole } from '../assetVisibility.ts';
import { listOwners } from '../ownerService.ts';

/** Upper bound on rows pulled into any single export, keeping exports bounded. */
const MAX_REPORT_ROWS = 10_000;
/** Page size used when draining paginated services into a full export. */
const EXPORT_PAGE_SIZE = 100;

/** Context every report builder receives; role drives sensitive-field redaction. */
interface ReportContext {
	role: null | UserRole;
}

/**
 * Drain a paginated service into a single bounded array for export.
 * @param fetchPage - Fetches one page of results by page number
 * @returns All rows across pages, capped at MAX_REPORT_ROWS
 */
function collectAll<T>(fetchPage: (page: number) => PaginatedResponse<T>): T[] {
	const out: T[] = [];
	let page = 1;
	for (;;) {
		const result = fetchPage(page);
		out.push(...result.data);
		if (
			result.data.length === 0 ||
			out.length >= result.total ||
			out.length >= MAX_REPORT_ROWS
		) {
			break;
		}
		page += 1;
	}
	return out.slice(0, MAX_REPORT_ROWS);
}

/**
 * All active assets, redacted for the requester's role. This is what makes
 * exports permission-filtered: VIEWER-level callers get the sensitive notes,
 * management URL, and support-contact fields nulled out.
 * @param ctx - The requester context (role drives redaction)
 * @returns All active assets, redacted for the role
 */
function collectAssets(ctx: ReportContext): ReturnType<typeof listAssets>['data'] {
	const rows = collectAll((page) =>
		listAssets({ includeDeleted: false, limit: EXPORT_PAGE_SIZE, page })
	);
	return rows.map((asset) => redactAssetForRole(asset, ctx.role));
}

/**
 * Owner id → display name map for humanizing owner columns.
 * @returns A map of owner id to owner name
 */
function ownerNames(): Map<number, string> {
	return new Map(listOwners().map((owner) => [owner.id, owner.name]));
}

/**
 * All ports across active assets, joined with the owning asset's name.
 * @returns Port rows with the owning asset's name attached
 */
function collectPorts(): Record<string, unknown>[] {
	const db = getDb();
	return db
		.select({
			assetId: assetPorts.assetId,
			assetName: assets.name,
			exposureLevel: assetPorts.exposureLevel,
			portNumber: assetPorts.portNumber,
			protocol: assetPorts.protocol,
			reviewState: assetPorts.reviewState,
			scope: assetPorts.scope,
			serviceName: assetPorts.serviceName,
			source: assetPorts.source,
		})
		.from(assetPorts)
		.innerJoin(assets, eq(assetPorts.assetId, assets.id))
		.where(eq(assets.isDeleted, false))
		.orderBy(asc(assets.name), asc(assetPorts.portNumber))
		.limit(MAX_REPORT_ROWS)
		.all();
}

export { collectAll, collectAssets, collectPorts, EXPORT_PAGE_SIZE, ownerNames };
export type { ReportContext };

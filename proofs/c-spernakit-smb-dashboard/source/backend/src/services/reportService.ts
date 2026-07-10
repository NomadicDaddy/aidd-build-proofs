import type { CsvColumn } from '../utils/csv.ts';
import type { ReportCategory } from './reports/definitions.ts';
import type { ReportContext } from './reports/sources.ts';

import { getInfrastructureSummary } from './assetSummaryService.ts';
import { REPORTS } from './reports/definitions.ts';

/** A fully materialized report ready to render as JSON or serialize to CSV. */
interface ReportPayload {
	category: ReportCategory;
	columns: CsvColumn[];
	description: string;
	key: string;
	label: string;
	rows: Record<string, unknown>[];
}

/** Metadata for one available report (no rows), used to render the export catalog. */
interface ReportInfo {
	category: ReportCategory;
	description: string;
	key: string;
	label: string;
}

/**
 * List every available report with its metadata, ordered by category then key.
 * @returns The report catalog entries
 */
function listReports(): ReportInfo[] {
	return Object.entries(REPORTS)
		.map(([key, def]) => ({
			category: def.category,
			description: def.description,
			key,
			label: def.label,
		}))
		.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}

/**
 * Whether a report key is known.
 * @param key - The candidate report key
 * @returns True when a report is registered under the key
 */
function isReportKey(key: string): boolean {
	return Object.prototype.hasOwnProperty.call(REPORTS, key);
}

/**
 * Build a report's full payload (columns + rows) for the given requester.
 * @param key - The report key to build
 * @param ctx - The requester context (role drives redaction)
 * @returns The materialized report, or null when the key is unknown
 */
function buildReport(key: string, ctx: ReportContext): null | ReportPayload {
	const def = REPORTS[key];
	if (!def) return null;
	return {
		category: def.category,
		columns: def.columns,
		description: def.description,
		key,
		label: def.label,
		rows: def.build(ctx),
	};
}

export { buildReport, getInfrastructureSummary, isReportKey, listReports };
export type { ReportInfo, ReportPayload };

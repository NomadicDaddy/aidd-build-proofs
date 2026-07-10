import type { DataResponse } from './types';

import { apiClient } from './client';

/** Export/report grouping: raw data dumps vs. audit-oriented reports. */
type ReportCategory = 'audit' | 'data';

/** Catalog metadata for one available report (no rows). */
interface ReportInfo {
	category: ReportCategory;
	description: string;
	key: string;
	label: string;
}

/** One labeled count within the management summary. */
interface CountBucket {
	count: number;
	key: string;
	label: string;
}

/** Risk indicators surfaced on the management summary. */
interface RiskSummary {
	criticalWithoutBackup: number;
	internetExposedPorts: number;
	unknownPorts: number;
	unownedAssets: number;
	unsupportedOs: number;
}

/** The subset of the infrastructure summary the printable overview renders. */
interface ManagementSummary {
	byCriticality: CountBucket[];
	byOwner: CountBucket[];
	bySite: CountBucket[];
	byStatus: CountBucket[];
	byType: CountBucket[];
	risks: RiskSummary;
	totalAssets: number;
}

/** List every available report with metadata. Requires VIEWER role or higher. */
async function listReports(): Promise<ReportInfo[]> {
	const res = await apiClient.get<DataResponse<ReportInfo[]>>('/reports');
	return res.data;
}

/** Get the full management summary payload. Requires VIEWER role or higher. */
async function getManagementSummary(): Promise<ManagementSummary> {
	const res = await apiClient.get<DataResponse<ManagementSummary>>('/reports/summary');
	return res.data;
}

/** Download a report as a CSV or JSON file blob. Requires VIEWER role or higher. */
function downloadReport(key: string, format: 'csv' | 'json'): Promise<Blob> {
	return apiClient.download(`/reports/${key}`, { params: { format } });
}

export { downloadReport, getManagementSummary, listReports };
export type { CountBucket, ManagementSummary, ReportCategory, ReportInfo };

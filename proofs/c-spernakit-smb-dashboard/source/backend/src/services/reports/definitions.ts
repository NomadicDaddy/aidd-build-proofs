import type { CsvColumn } from '../../utils/csv.ts';
import type { ReportContext } from './sources.ts';

import { listRelationshipsEnriched } from '../assetRelationshipService.ts';
import { getInfrastructureSummary } from '../assetSummaryService.ts';
import { query as auditQuery } from '../auditService.ts';
import { listServicesEnriched } from '../serviceCatalogQueries.ts';
import {
	collectAll,
	collectAssets,
	collectPorts,
	EXPORT_PAGE_SIZE,
	ownerNames,
} from './sources.ts';

/** Grouping used by the UI to separate raw data dumps from audit-oriented reports. */
type ReportCategory = 'audit' | 'data';

interface ReportDefinition {
	build: (ctx: ReportContext) => Record<string, unknown>[];
	category: ReportCategory;
	columns: CsvColumn[];
	description: string;
	label: string;
}

const ASSET_COLUMNS: CsvColumn[] = [
	{ key: 'id', label: 'ID' },
	{ key: 'name', label: 'Name' },
	{ key: 'assetType', label: 'Type' },
	{ key: 'status', label: 'Status' },
	{ key: 'criticality', label: 'Criticality' },
	{ key: 'hostname', label: 'Hostname' },
	{ key: 'fqdn', label: 'FQDN' },
	{ key: 'primaryIp', label: 'Primary IP' },
	{ key: 'operatingSystem', label: 'Operating System' },
	{ key: 'businessOwner', label: 'Business Owner' },
	{ key: 'technicalOwner', label: 'Technical Owner' },
	{ key: 'supportEndsAt', label: 'Support Ends' },
	{ key: 'notes', label: 'Notes' },
];

const REPORTS: Record<string, ReportDefinition> = {
	assets: {
		build: (ctx) => {
			const owners = ownerNames();
			return collectAssets(ctx).map((a) => ({
				assetType: a.assetType,
				businessOwner:
					a.businessOwnerId === null ? null : (owners.get(a.businessOwnerId) ?? null),
				criticality: a.criticality,
				fqdn: a.fqdn,
				hostname: a.hostname,
				id: a.id,
				name: a.name,
				notes: a.notes,
				operatingSystem: a.operatingSystem,
				primaryIp: a.primaryIp,
				status: a.status,
				supportEndsAt: a.supportEndsAt,
				technicalOwner:
					a.technicalOwnerId === null ? null : (owners.get(a.technicalOwnerId) ?? null),
			}));
		},
		category: 'data',
		columns: ASSET_COLUMNS,
		description: 'Every active asset with type, status, ownership, and lifecycle fields.',
		label: 'Assets',
	},
	changes: {
		build: () =>
			collectAll((page) => auditQuery({ limit: EXPORT_PAGE_SIZE, page })).map((e) => ({
				action: e.action,
				details: e.details ?? null,
				resource: e.resource,
				resourceId: e.resourceId,
				timestamp: e.createdAt,
				username: e.username,
			})),
		category: 'audit',
		columns: [
			{ key: 'timestamp', label: 'Timestamp' },
			{ key: 'username', label: 'User' },
			{ key: 'action', label: 'Action' },
			{ key: 'resource', label: 'Resource' },
			{ key: 'resourceId', label: 'Resource ID' },
			{ key: 'details', label: 'Details' },
		],
		description: 'Audit trail of recorded actions across the system, newest first.',
		label: 'Change history',
	},
	'exposed-ports': {
		build: () =>
			collectPorts()
				.filter((p) => p.exposureLevel === 'internet')
				.map((p) => ({
					assetName: p.assetName,
					exposureLevel: p.exposureLevel,
					portNumber: p.portNumber,
					protocol: p.protocol,
					reviewState: p.reviewState,
					serviceName: p.serviceName,
				})),
		category: 'audit',
		columns: [
			{ key: 'assetName', label: 'Asset' },
			{ key: 'portNumber', label: 'Port' },
			{ key: 'protocol', label: 'Protocol' },
			{ key: 'serviceName', label: 'Service' },
			{ key: 'exposureLevel', label: 'Exposure' },
			{ key: 'reviewState', label: 'Review State' },
		],
		description: 'Ports flagged as internet-exposed, for attack-surface review.',
		label: 'Exposed ports',
	},
	lifecycle: {
		build: (ctx) => {
			const now = Date.now();
			return collectAssets(ctx).map((a) => ({
				criticality: a.criticality,
				id: a.id,
				name: a.name,
				plannedReplacementAt: a.plannedReplacementAt,
				status: a.status,
				supportEndsAt: a.supportEndsAt,
				unsupported: a.supportEndsAt !== null && new Date(a.supportEndsAt).getTime() < now,
				warrantyExpiresAt: a.warrantyExpiresAt,
			}));
		},
		category: 'audit',
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'name', label: 'Name' },
			{ key: 'status', label: 'Status' },
			{ key: 'criticality', label: 'Criticality' },
			{ key: 'supportEndsAt', label: 'Support Ends' },
			{ key: 'warrantyExpiresAt', label: 'Warranty Expires' },
			{ key: 'plannedReplacementAt', label: 'Planned Replacement' },
			{ key: 'unsupported', label: 'Unsupported' },
		],
		description: 'Asset lifecycle status with support, warranty, and replacement dates.',
		label: 'Lifecycle status',
	},
	'ownership-gaps': {
		build: (ctx) =>
			collectAssets(ctx)
				.filter((a) => a.businessOwnerId === null && a.technicalOwnerId === null)
				.map((a) => ({
					assetType: a.assetType,
					criticality: a.criticality,
					hostname: a.hostname,
					id: a.id,
					name: a.name,
					primaryIp: a.primaryIp,
					status: a.status,
				})),
		category: 'audit',
		columns: [
			{ key: 'id', label: 'ID' },
			{ key: 'name', label: 'Name' },
			{ key: 'assetType', label: 'Type' },
			{ key: 'status', label: 'Status' },
			{ key: 'criticality', label: 'Criticality' },
			{ key: 'hostname', label: 'Hostname' },
			{ key: 'primaryIp', label: 'Primary IP' },
		],
		description: 'Active assets missing both a business and a technical owner.',
		label: 'Ownership gaps',
	},
	ports: {
		build: () => collectPorts(),
		category: 'data',
		columns: [
			{ key: 'assetName', label: 'Asset' },
			{ key: 'portNumber', label: 'Port' },
			{ key: 'protocol', label: 'Protocol' },
			{ key: 'exposureLevel', label: 'Exposure' },
			{ key: 'reviewState', label: 'Review State' },
			{ key: 'serviceName', label: 'Service' },
			{ key: 'scope', label: 'Scope' },
			{ key: 'source', label: 'Source' },
		],
		description: 'Every documented and observed port across active assets.',
		label: 'Ports',
	},
	relationships: {
		build: () =>
			collectAll((page) =>
				listRelationshipsEnriched({ includeDeleted: false, limit: EXPORT_PAGE_SIZE, page })
			).map((r) => ({
				confidence: r.confidence,
				relationshipType: r.relationshipType,
				sourceAsset: r.sourceAssetName,
				sourceType: r.sourceAssetType,
				targetAsset: r.targetAssetName,
				targetType: r.targetAssetType,
			})),
		category: 'data',
		columns: [
			{ key: 'sourceAsset', label: 'Source' },
			{ key: 'sourceType', label: 'Source Type' },
			{ key: 'relationshipType', label: 'Relationship' },
			{ key: 'targetAsset', label: 'Target' },
			{ key: 'targetType', label: 'Target Type' },
			{ key: 'confidence', label: 'Confidence' },
		],
		description: 'Dependency edges between assets with both endpoints resolved.',
		label: 'Relationships',
	},
	services: {
		build: () =>
			collectAll((page) =>
				listServicesEnriched({ includeDeleted: false, limit: EXPORT_PAGE_SIZE, page })
			).map((s) => ({
				backingAssetCount: s.backingAssetCount,
				category: s.category,
				criticality: s.criticality,
				expectedAvailability: s.expectedAvailability,
				name: s.name,
				owner: s.ownerName,
				vendor: s.vendorName,
			})),
		category: 'data',
		columns: [
			{ key: 'name', label: 'Name' },
			{ key: 'category', label: 'Category' },
			{ key: 'criticality', label: 'Criticality' },
			{ key: 'owner', label: 'Owner' },
			{ key: 'vendor', label: 'Vendor' },
			{ key: 'backingAssetCount', label: 'Backing Assets' },
			{ key: 'expectedAvailability', label: 'Expected Availability' },
		],
		description: 'Business and technical service catalog with owners and backing assets.',
		label: 'Services',
	},
	summary: {
		build: () => {
			const s = getInfrastructureSummary();
			const rows: Record<string, unknown>[] = [
				{ label: 'Total assets', section: 'Totals', value: s.totalAssets },
			];
			const bucket = (section: string, buckets: { count: number; label: string }[]): void => {
				for (const b of buckets) rows.push({ label: b.label, section, value: b.count });
			};
			bucket('By type', s.byType);
			bucket('By status', s.byStatus);
			bucket('By criticality', s.byCriticality);
			bucket('By site', s.bySite);
			bucket('By owner', s.byOwner);
			rows.push(
				{ label: 'Unowned assets', section: 'Risks', value: s.risks.unownedAssets },
				{ label: 'Unsupported OS', section: 'Risks', value: s.risks.unsupportedOs },
				{
					label: 'Internet-exposed ports',
					section: 'Risks',
					value: s.risks.internetExposedPorts,
				},
				{
					label: 'Unknown/unexpected ports',
					section: 'Risks',
					value: s.risks.unknownPorts,
				},
				{
					label: 'Critical without backup',
					section: 'Risks',
					value: s.risks.criticalWithoutBackup,
				}
			);
			return rows;
		},
		category: 'data',
		columns: [
			{ key: 'section', label: 'Section' },
			{ key: 'label', label: 'Metric' },
			{ key: 'value', label: 'Value' },
		],
		description: 'Flattened management summary: counts by dimension and risk indicators.',
		label: 'Management summary',
	},
};

export { REPORTS };
export type { ReportCategory, ReportDefinition };

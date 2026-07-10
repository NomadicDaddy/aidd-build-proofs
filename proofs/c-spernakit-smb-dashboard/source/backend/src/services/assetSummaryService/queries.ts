import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import { and, count, countDistinct, eq, inArray, isNull, lt, sql, sum } from 'drizzle-orm';

import type {
	CapacitySummary,
	CountBucket,
	InfrastructureSummary,
	RiskSummary,
	StorageSummary,
	TopService,
	VirtualizationSummary,
} from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetHardwareProfiles, assetStorageAllocations } from '../../db/schema/assetProfiles.ts';
import { assetRelationships } from '../../db/schema/assetRelationships.ts';
import { assets } from '../../db/schema/assets.ts';
import { owners, sites } from '../../db/schema/infrastructure.ts';
import { assetPorts, assetServices, serviceCatalog } from '../../db/schema/services.ts';

/** Criticality ordering for ranking services (lower = more critical). */
const CRITICALITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	low: 3,
	medium: 2,
	unknown: 4,
};

const UNKNOWN_PORT_REVIEW_STATES = ['needs_review', 'unexpected'] as const;
const CRITICAL_LEVELS = ['critical', 'high'] as const;
const UNASSIGNED_LABEL = 'Unassigned';
const TOP_SERVICE_LIMIT = 6;

// Coerce a nullable SQLite aggregate (returned as string | null) to a number.
function toNumber(value: null | number | string | undefined): number {
	if (value === null || value === undefined) return 0;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

// Group non-deleted assets by a single enum column into labelled count buckets.
function countBy(column: AnySQLiteColumn): CountBucket[] {
	const db = getDb();
	const rows = db
		.select({ bucket: column, total: count() })
		.from(assets)
		.where(eq(assets.isDeleted, false))
		.groupBy(column)
		.all();
	return rows.map((r) => ({ count: r.total, key: String(r.bucket), label: String(r.bucket) }));
}

// Counts by site name, joining through the sites table; null sites collapse to "Unassigned".
function countBySite(): CountBucket[] {
	const db = getDb();
	const rows = db
		.select({ siteId: assets.siteId, siteName: sites.name, total: count() })
		.from(assets)
		.leftJoin(sites, eq(assets.siteId, sites.id))
		.where(eq(assets.isDeleted, false))
		.groupBy(assets.siteId)
		.all();
	return rows.map((r) => ({
		count: r.total,
		key: r.siteId === null ? 'unassigned' : String(r.siteId),
		label: r.siteName ?? UNASSIGNED_LABEL,
	}));
}

// Counts by business owner name; assets with no business owner collapse to "Unassigned".
function countByOwner(): CountBucket[] {
	const db = getDb();
	const rows = db
		.select({ ownerId: assets.businessOwnerId, ownerName: owners.name, total: count() })
		.from(assets)
		.leftJoin(owners, eq(assets.businessOwnerId, owners.id))
		.where(eq(assets.isDeleted, false))
		.groupBy(assets.businessOwnerId)
		.all();
	return rows.map((r) => ({
		count: r.total,
		key: r.ownerId === null ? 'unassigned' : String(r.ownerId),
		label: r.ownerName ?? UNASSIGNED_LABEL,
	}));
}

// Count non-deleted assets matching the extra predicate(s).
function assetCount(...predicates: (ReturnType<typeof eq> | undefined)[]): number {
	const db = getDb();
	return toNumber(
		db
			.select({ total: count() })
			.from(assets)
			.where(and(eq(assets.isDeleted, false), ...predicates))
			.get()?.total
	);
}

// Physical vs virtual split plus hypervisor-host and orphaned-VM tallies.
function virtualizationSummary(): VirtualizationSummary {
	return {
		hypervisorHosts: assetCount(eq(assets.assetType, 'hypervisor_host')),
		orphanVirtual: assetCount(eq(assets.isVirtual, true), isNull(assets.parentHostId)),
		physical: assetCount(eq(assets.isVirtual, false)),
		virtual: assetCount(eq(assets.isVirtual, true)),
	};
}

// Sum CPU cores, RAM, and storage across assets that carry a hardware profile.
function capacitySummary(): CapacitySummary {
	const db = getDb();
	const row = db
		.select({
			profiled: count(),
			ram: sum(assetHardwareProfiles.ramMb),
			storage: sum(assetHardwareProfiles.totalStorageGb),
			totalCpu: sum(assetHardwareProfiles.cpuCores),
		})
		.from(assetHardwareProfiles)
		.innerJoin(assets, eq(assetHardwareProfiles.assetId, assets.id))
		.where(eq(assets.isDeleted, false))
		.get();
	return {
		profiledAssets: toNumber(row?.profiled),
		totalCpuCores: toNumber(row?.totalCpu),
		totalRamMb: toNumber(row?.ram),
		totalStorageGb: toNumber(row?.storage),
	};
}

// Sum total, used, and free storage across every allocation on live assets.
function storageSummary(): StorageSummary {
	const db = getDb();
	const row = db
		.select({
			allocations: count(),
			capacity: sum(assetStorageAllocations.capacityGb),
			pools: countDistinct(assetStorageAllocations.storagePoolAssetId),
			used: sum(assetStorageAllocations.usedGb),
		})
		.from(assetStorageAllocations)
		.innerJoin(assets, eq(assetStorageAllocations.assetId, assets.id))
		.where(eq(assets.isDeleted, false))
		.get();
	const totalCapacityGb = toNumber(row?.capacity);
	const totalUsedGb = toNumber(row?.used);
	return {
		allocationCount: toNumber(row?.allocations),
		poolCount: toNumber(row?.pools),
		totalCapacityGb,
		totalFreeGb: Math.max(0, totalCapacityGb - totalUsedGb),
		totalUsedGb,
	};
}

// Top business services ranked by criticality then backing-asset count.
function topServices(): TopService[] {
	const db = getDb();
	const rows = db
		.select({
			backing: count(assetServices.assetId),
			criticality: serviceCatalog.criticality,
			id: serviceCatalog.id,
			name: serviceCatalog.name,
		})
		.from(serviceCatalog)
		.leftJoin(assetServices, eq(assetServices.serviceId, serviceCatalog.id))
		.where(eq(serviceCatalog.isDeleted, false))
		.groupBy(serviceCatalog.id)
		.all();
	return rows
		.map((r) => ({
			backingAssetCount: r.backing,
			criticality: r.criticality,
			id: r.id,
			name: r.name,
		}))
		.sort(
			(a, b) =>
				(CRITICALITY_RANK[a.criticality] ?? 99) - (CRITICALITY_RANK[b.criticality] ?? 99) ||
				b.backingAssetCount - a.backingAssetCount
		)
		.slice(0, TOP_SERVICE_LIMIT);
}

// Count operational risk cues across the live inventory.
function riskSummary(): RiskSummary {
	const db = getDb();
	const base = eq(assets.isDeleted, false);
	const portCount = (predicate: ReturnType<typeof eq>): number =>
		toNumber(
			db
				.select({ total: count() })
				.from(assetPorts)
				.innerJoin(assets, eq(assetPorts.assetId, assets.id))
				.where(and(base, predicate))
				.get()?.total
		);

	const internetExposedPorts = portCount(eq(assetPorts.exposureLevel, 'internet'));
	const unknownPorts = portCount(
		inArray(assetPorts.reviewState, [...UNKNOWN_PORT_REVIEW_STATES])
	);
	const unsupportedOs = assetCount(lt(assets.supportEndsAt, new Date()));
	const unownedAssets = assetCount(
		isNull(assets.businessOwnerId),
		isNull(assets.technicalOwnerId)
	);
	// Critical/high assets with no active "backs_up_to" relationship pointing outward.
	const backedUp = db
		.select({ id: assetRelationships.sourceAssetId })
		.from(assetRelationships)
		.where(
			and(
				eq(assetRelationships.isDeleted, false),
				eq(assetRelationships.relationshipType, 'backs_up_to')
			)
		);
	const criticalWithoutBackup = toNumber(
		db
			.select({ total: count() })
			.from(assets)
			.where(
				and(
					base,
					inArray(assets.criticality, [...CRITICAL_LEVELS]),
					sql`${assets.id} not in ${backedUp}`
				)
			)
			.get()?.total
	);

	return {
		criticalWithoutBackup,
		internetExposedPorts,
		unknownPorts,
		unownedAssets,
		unsupportedOs,
	};
}

/**
 * Build the full operational dashboard summary from the live (non-deleted)
 * inventory. Every aggregate degrades gracefully to zero/empty when its backing
 * records (services, ports, relationships, hardware profiles) do not yet exist.
 * @returns The aggregate infrastructure summary for the operational dashboard.
 */
function getInfrastructureSummary(): InfrastructureSummary {
	return {
		byCriticality: countBy(assets.criticality),
		byOwner: countByOwner(),
		bySite: countBySite(),
		byStatus: countBy(assets.status),
		byType: countBy(assets.assetType),
		capacity: capacitySummary(),
		risks: riskSummary(),
		storage: storageSummary(),
		topServices: topServices(),
		totalAssets: assetCount(),
		virtualization: virtualizationSummary(),
	};
}

export { getInfrastructureSummary };

import type { DataResponse } from './types';

import { apiClient } from './client';

/** A named bucket with its asset count (e.g. one asset type or one site). */
interface CountBucket {
	count: number;
	key: string;
	label: string;
}

/** Physical/virtual split plus virtualization role tallies. */
interface VirtualizationSummary {
	hypervisorHosts: number;
	orphanVirtual: number;
	physical: number;
	virtual: number;
}

/** Aggregate hardware capacity across assets that carry a hardware profile. */
interface CapacitySummary {
	profiledAssets: number;
	totalCpuCores: number;
	totalRamMb: number;
	totalStorageGb: number;
}

/** Aggregate storage-allocation capacity across the live inventory. */
interface StorageSummary {
	allocationCount: number;
	poolCount: number;
	totalCapacityGb: number;
	totalFreeGb: number;
	totalUsedGb: number;
}

/** A business service and how much infrastructure backs it. */
interface TopService {
	backingAssetCount: number;
	criticality: string;
	id: number;
	name: string;
}

/** Operational risk cues surfaced on the dashboard. */
interface RiskSummary {
	criticalWithoutBackup: number;
	internetExposedPorts: number;
	unknownPorts: number;
	unownedAssets: number;
	unsupportedOs: number;
}

/**
 * Aggregate infrastructure figures for the operational dashboard. Mirrors the
 * backend `InfrastructureSummary` returned by `GET /infrastructure/summary`.
 */
interface InfrastructureSummary {
	byCriticality: CountBucket[];
	byOwner: CountBucket[];
	bySite: CountBucket[];
	byStatus: CountBucket[];
	byType: CountBucket[];
	capacity: CapacitySummary;
	risks: RiskSummary;
	storage: StorageSummary;
	topServices: TopService[];
	totalAssets: number;
	virtualization: VirtualizationSummary;
}

/** Fetch the operational dashboard summary. Requires VIEWER role or higher. */
function getInfrastructureSummary(): Promise<DataResponse<InfrastructureSummary>> {
	return apiClient.get<DataResponse<InfrastructureSummary>>('/infrastructure/summary');
}

export { getInfrastructureSummary };
export type {
	CapacitySummary,
	CountBucket,
	InfrastructureSummary,
	RiskSummary,
	StorageSummary,
	TopService,
	VirtualizationSummary,
};

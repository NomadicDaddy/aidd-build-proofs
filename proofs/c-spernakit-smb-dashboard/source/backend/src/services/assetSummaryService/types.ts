/** A named bucket with its asset count, used for the "counts by dimension" cards. */
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
/** Aggregate hardware capacity across assets that have a hardware profile. */
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
/** Everything the operational dashboard renders in one payload. */
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

export type {
	CapacitySummary,
	CountBucket,
	InfrastructureSummary,
	RiskSummary,
	StorageSummary,
	TopService,
	VirtualizationSummary,
};

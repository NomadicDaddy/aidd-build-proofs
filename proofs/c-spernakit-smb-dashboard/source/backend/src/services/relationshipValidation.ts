import type { AssetRelationshipType, AssetType } from 'spernakit-shared';

/**
 * Semantic plausibility rules for directed asset relationships.
 *
 * Each relationship type may constrain the asset types allowed at its source
 * and/or target endpoint. A missing constraint (undefined) means "any asset
 * type is acceptable". The `other` asset type is always accepted as an escape
 * hatch so unusual-but-real topologies are never blocked outright.
 *
 * These rules exist to catch nonsensical edges (e.g. a storage volume that
 * "runs on" a virtual machine). Callers may bypass them by explicitly marking a
 * relationship as unusual (`allowUnusual`), which is the "explicitly marked
 * special" carve-out required by the spec.
 */

interface RelationshipRule {
	/** Allowed source asset types; undefined means unconstrained. */
	source?: readonly AssetType[];
	/** Allowed target asset types; undefined means unconstrained. */
	target?: readonly AssetType[];
}

/** Host platforms something can "run on". */
const HOST_TYPES = ['hypervisor_host', 'physical_server', 'other'] as const;
/** Things that can run on a host. */
const HOSTED_TYPES = [
	'virtual_machine',
	'application_endpoint',
	'business_service',
	'other',
] as const;
/** Places data can live. */
const STORAGE_TYPES = ['storage_appliance', 'storage_volume', 'backup_target', 'other'] as const;

/**
 * Per-relationship-type endpoint constraints. Only the types with clear physical
 * or logical semantics are constrained; generic relationships (depends_on,
 * connects_to, part_of, owned_by, provides_service) accept any endpoints.
 */
const RELATIONSHIP_RULES: Partial<Record<AssetRelationshipType, RelationshipRule>> = {
	backs_up_to: { target: STORAGE_TYPES },
	hosts: { source: HOST_TYPES, target: HOSTED_TYPES },
	runs_on: { source: HOSTED_TYPES, target: HOST_TYPES },
	stores_on: { target: STORAGE_TYPES },
};

const ASSET_TYPE_LABELS: Record<string, string> = {
	application_endpoint: 'application endpoint',
	backup_target: 'backup target',
	business_service: 'business service',
	firewall_router: 'firewall/router',
	hypervisor_host: 'hypervisor host',
	network_device: 'network device',
	other: 'other',
	physical_server: 'physical server',
	storage_appliance: 'storage appliance',
	storage_volume: 'storage volume',
	virtual_machine: 'virtual machine',
};

function labelFor(assetType: string): string {
	return ASSET_TYPE_LABELS[assetType] ?? assetType;
}

/**
 * Check whether a relationship between two asset types is semantically plausible.
 *
 * @param relationshipType - The directed relationship type
 * @param sourceType - Asset type of the source endpoint
 * @param targetType - Asset type of the target endpoint
 * @returns An error message when the edge is nonsensical, or null when plausible
 */
function checkRelationshipPlausibility(
	relationshipType: string,
	sourceType: string,
	targetType: string
): null | string {
	const rule = RELATIONSHIP_RULES[relationshipType as AssetRelationshipType];
	if (!rule) {
		return null;
	}

	if (rule.source && !rule.source.includes(sourceType as AssetType)) {
		return (
			`A "${labelFor(sourceType)}" asset cannot be the source of a "${relationshipType}" ` +
			`relationship. Mark the relationship as unusual to override.`
		);
	}
	if (rule.target && !rule.target.includes(targetType as AssetType)) {
		return (
			`A "${relationshipType}" relationship cannot target a "${labelFor(targetType)}" asset. ` +
			`Mark the relationship as unusual to override.`
		);
	}
	return null;
}

export { checkRelationshipPlausibility };

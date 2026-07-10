import type { AssetRelationshipType, AssetType } from 'spernakit-shared';

/**
 * Categorical fill colour for each asset type node. Mid-saturation hues chosen
 * to stay legible on both the light and dark canvas backgrounds while remaining
 * visually distinct from one another.
 */
const ASSET_TYPE_COLORS: Record<AssetType, string> = {
	application_endpoint: '#8b5cf6',
	backup_target: '#a16207',
	business_service: '#2563eb',
	firewall_router: '#dc2626',
	hypervisor_host: '#0891b2',
	network_device: '#0d9488',
	other: '#64748b',
	physical_server: '#4f46e5',
	storage_appliance: '#c026d3',
	storage_volume: '#db2777',
	virtual_machine: '#059669',
};

const DEFAULT_NODE_COLOR = '#64748b';

/** Fill colour for a node of the given (possibly unknown) asset type. */
function assetTypeColor(assetType: AssetType | null): string {
	if (!assetType) return DEFAULT_NODE_COLOR;
	return ASSET_TYPE_COLORS[assetType] ?? DEFAULT_NODE_COLOR;
}

/**
 * Stroke colour per relationship type so edges are visually distinguishable.
 * Runtime-dependency edges (runs_on, hosts, depends_on, …) get warmer, more
 * prominent hues; softer, non-runtime edges (connects_to, owned_by, part_of)
 * get cooler, muted tones.
 */
const RELATIONSHIP_TYPE_COLORS: Record<AssetRelationshipType, string> = {
	backs_up_to: '#a16207',
	connects_to: '#94a3b8',
	depends_on: '#dc2626',
	hosts: '#0891b2',
	owned_by: '#a855f7',
	part_of: '#64748b',
	provides_service: '#2563eb',
	runs_on: '#059669',
	stores_on: '#db2777',
};

const DEFAULT_EDGE_COLOR = '#94a3b8';

/** Stroke colour for an edge of the given relationship type. */
function relationshipTypeColor(relationshipType: AssetRelationshipType): string {
	return RELATIONSHIP_TYPE_COLORS[relationshipType] ?? DEFAULT_EDGE_COLOR;
}

export { assetTypeColor, relationshipTypeColor };

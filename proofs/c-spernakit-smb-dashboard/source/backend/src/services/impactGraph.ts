import type {
	AssetRelationshipType,
	AssetStatus,
	AssetType,
	CriticalityLevel,
} from 'spernakit-shared';

/**
 * Which endpoint of a directed relationship is the *provider* — the asset whose
 * outage propagates to the other endpoint. `null` means the relationship is not a
 * runtime dependency (pure connectivity or organizational ownership) and is
 * excluded from impact traversal so it never yields a false "breaks if offline".
 *
 * Reading the edge as source →(type)→ target:
 * - runs_on: a VM runs_on a host — the host (target) provides.
 * - hosts: a host hosts a VM — the host (source) provides.
 * - depends_on: A depends_on B — B (target) provides.
 * - provides_service: A provides_service to B — A (source) provides.
 * - stores_on: A stores_on storage — the storage (target) provides.
 * - backs_up_to: A backs_up_to a target — the backup target (target) provides.
 * - part_of: a component is part_of a system — the component (source) provides to the whole.
 * - connects_to / owned_by: not a runtime dependency.
 */
const PROVIDER_ENDPOINT: Record<AssetRelationshipType, 'source' | 'target' | null> = {
	backs_up_to: 'target',
	connects_to: null,
	depends_on: 'target',
	hosts: 'source',
	owned_by: null,
	part_of: 'source',
	provides_service: 'source',
	runs_on: 'target',
	stores_on: 'target',
};

/** A minimal asset identity carried through the impact graph. */
interface ImpactAsset {
	assetType: AssetType;
	criticality: CriticalityLevel;
	id: number;
	name: string;
	status: AssetStatus;
}

/** One asset reached during traversal, annotated with how it was reached. */
interface ImpactNode extends ImpactAsset {
	/** Hop distance from the root asset (1 = direct neighbour). */
	depth: number;
	/** The relationship type of the edge that first reached this node. */
	relationshipType: AssetRelationshipType;
	/** The id of the already-visited asset the edge came from. */
	viaAssetId: number;
}

/** A directed dependency edge in the impact graph: provider outage impacts dependent. */
interface DependencyEdge {
	dependent: number;
	provider: number;
	relationshipType: AssetRelationshipType;
}

/** A typed neighbour reached from an adjacency key. */
interface Neighbour {
	relationshipType: AssetRelationshipType;
	to: number;
}

/**
 * Build an adjacency map from one edge endpoint to the neighbours it reaches.
 *
 * @param edges - The directed dependency edges
 * @param from - Which endpoint keys the map ('provider' walks downstream, 'dependent' upstream)
 * @returns A map from each keyed asset id to its typed neighbours
 */
function buildAdjacency(
	edges: DependencyEdge[],
	from: 'dependent' | 'provider'
): Map<number, Neighbour[]> {
	const to = from === 'provider' ? 'dependent' : 'provider';
	const adjacency = new Map<number, Neighbour[]>();
	for (const edge of edges) {
		const key = edge[from];
		const neighbour = edge[to];
		const list = adjacency.get(key) ?? [];
		list.push({ relationshipType: edge.relationshipType, to: neighbour });
		adjacency.set(key, list);
	}
	return adjacency;
}

/**
 * Breadth-first traversal from the root over an adjacency map, returning each
 * reachable asset once (shortest hop distance wins) with the edge that first
 * reached it. Cycles are handled by the visited set anchored on the root.
 *
 * @param rootId - The asset id to start from
 * @param adjacency - The neighbour map to walk
 * @param assetIndex - Lookup used to resolve each reached id to its identity
 * @returns The reached assets as impact nodes, in breadth-first order
 */
function traverse(
	rootId: number,
	adjacency: Map<number, Neighbour[]>,
	assetIndex: Map<number, ImpactAsset>
): ImpactNode[] {
	const visited = new Set<number>([rootId]);
	const result: ImpactNode[] = [];
	let frontier: { depth: number; id: number }[] = [{ depth: 0, id: rootId }];

	while (frontier.length > 0) {
		const next: { depth: number; id: number }[] = [];
		for (const current of frontier) {
			const neighbours = adjacency.get(current.id) ?? [];
			for (const neighbour of neighbours) {
				if (visited.has(neighbour.to)) continue;
				visited.add(neighbour.to);
				const asset = assetIndex.get(neighbour.to);
				if (!asset) continue;
				const depth = current.depth + 1;
				result.push({
					...asset,
					depth,
					relationshipType: neighbour.relationshipType,
					viaAssetId: current.id,
				});
				next.push({ depth, id: neighbour.to });
			}
		}
		frontier = next;
	}

	return result;
}

/**
 * The largest depth across a set of impact nodes, or 0 when empty.
 *
 * @param nodes - The impact nodes to scan
 * @returns The maximum hop depth, or 0 when the set is empty
 */
function maxDepth(nodes: ImpactNode[]): number {
	return nodes.reduce((max, node) => (node.depth > max ? node.depth : max), 0);
}

export type { DependencyEdge, ImpactAsset, ImpactNode };
export { buildAdjacency, maxDepth, PROVIDER_ENDPOINT, traverse };

import type {
	AssetRelationshipType,
	AssetType,
	RelationshipConfidenceLevel,
} from 'spernakit-shared';

import type { Relationship } from '@/api/relationships';

/** A node in the topology graph — one asset, derived from relationship endpoints. */
interface GraphNode {
	assetType: AssetType | null;
	/** Number of relationships (in + out) touching this asset within the graph. */
	degree: number;
	id: number;
	name: string;
}

/** A directed edge in the topology graph, mirroring one relationship row. */
interface GraphEdge {
	confidence: RelationshipConfidenceLevel;
	id: number;
	relationshipType: AssetRelationshipType;
	source: number;
	target: number;
}

/** A resolved topology graph: unique asset nodes plus the edges between them. */
interface Graph {
	edges: GraphEdge[];
	nodes: GraphNode[];
}

/**
 * Collapse a flat list of directed relationships into a de-duplicated node/edge
 * graph. Each endpoint asset becomes a single node (keyed by id) even when it
 * appears in many relationships, and every relationship becomes one directed
 * edge. Node degree is accumulated so the layout and inspector can emphasise
 * highly-connected hubs.
 */
function buildGraph(relationships: Relationship[]): Graph {
	const nodeMap = new Map<number, GraphNode>();

	const ensureNode = (id: number, name: null | string, assetType: AssetType | null): void => {
		const existing = nodeMap.get(id);
		if (existing) {
			if (!existing.assetType && assetType) existing.assetType = assetType;
			return;
		}
		nodeMap.set(id, { assetType, degree: 0, id, name: name ?? `Asset #${id}` });
	};

	const edges: GraphEdge[] = relationships.map((rel) => {
		ensureNode(rel.sourceAssetId, rel.sourceAssetName, rel.sourceAssetType);
		ensureNode(rel.targetAssetId, rel.targetAssetName, rel.targetAssetType);
		const source = nodeMap.get(rel.sourceAssetId);
		const target = nodeMap.get(rel.targetAssetId);
		if (source) source.degree += 1;
		if (target) target.degree += 1;
		return {
			confidence: rel.confidence,
			id: rel.id,
			relationshipType: rel.relationshipType,
			source: rel.sourceAssetId,
			target: rel.targetAssetId,
		};
	});

	return { edges, nodes: [...nodeMap.values()] };
}

/** Build an undirected adjacency map for neighbourhood traversal. */
function buildAdjacency(graph: Graph): Map<number, number[]> {
	const adjacency = new Map<number, number[]>();
	const link = (from: number, to: number): void => {
		const list = adjacency.get(from);
		if (list) list.push(to);
		else adjacency.set(from, [to]);
	};
	for (const edge of graph.edges) {
		link(edge.source, edge.target);
		link(edge.target, edge.source);
	}
	return adjacency;
}

/**
 * Extract the sub-graph reachable from a focus asset within `maxDepth` hops
 * (undirected, so both dependencies and dependents are included). This powers
 * the "focus on one asset" scope and the one-hop / multi-hop expansion control:
 * depth 1 is the immediate neighbourhood, higher depths grow the dependency
 * tree outward. Returns an empty graph when the focus asset has no edges.
 */
function subgraphAround(graph: Graph, focusId: number, maxDepth: number): Graph {
	if (!graph.nodes.some((node) => node.id === focusId)) {
		return { edges: [], nodes: [] };
	}
	const adjacency = buildAdjacency(graph);
	const depthById = new Map<number, number>([[focusId, 0]]);
	const queue: number[] = [focusId];
	while (queue.length > 0) {
		const current = queue.shift() as number;
		const depth = depthById.get(current) ?? 0;
		if (depth >= maxDepth) continue;
		for (const neighbour of adjacency.get(current) ?? []) {
			if (!depthById.has(neighbour)) {
				depthById.set(neighbour, depth + 1);
				queue.push(neighbour);
			}
		}
	}
	return {
		edges: graph.edges.filter(
			(edge) => depthById.has(edge.source) && depthById.has(edge.target)
		),
		nodes: graph.nodes.filter((node) => depthById.has(node.id)),
	};
}

/**
 * Keep only nodes of the given asset type and the edges between two kept nodes.
 * An empty `assetType` returns the graph unchanged. Applied client-side because
 * node type is carried on the enriched relationship endpoints.
 */
function filterGraphByAssetType(graph: Graph, assetType: string): Graph {
	if (!assetType) return graph;
	const keptIds = new Set(
		graph.nodes.filter((node) => node.assetType === assetType).map((node) => node.id)
	);
	return {
		edges: graph.edges.filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target)),
		nodes: graph.nodes.filter((node) => keptIds.has(node.id)),
	};
}

export { buildGraph, filterGraphByAssetType, subgraphAround };
export type { Graph, GraphNode };

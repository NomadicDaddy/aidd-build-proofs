import type { Graph } from './graphTypes';

/** A 2D position in the layout coordinate space. */
interface Point {
	x: number;
	y: number;
}

/** Positions keyed by asset id, plus the bounding box of all nodes. */
interface Layout {
	bounds: { height: number; width: number; x: number; y: number };
	positions: Map<number, Point>;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;
const ITERATIONS = 300;

/** Compute the axis-aligned bounds of a set of positions, with padding. */
function computeBounds(positions: Map<number, Point>): Layout['bounds'] {
	if (positions.size === 0) {
		return { height: CANVAS_HEIGHT, width: CANVAS_WIDTH, x: 0, y: 0 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const point of positions.values()) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}
	const padding = 80;
	return {
		height: maxY - minY + padding * 2,
		width: maxX - minX + padding * 2,
		x: minX - padding,
		y: minY - padding,
	};
}

/**
 * Deterministic force-directed layout. Nodes seed onto a circle by index (no
 * randomness, so the same graph always lays out identically) and are then
 * relaxed with pairwise repulsion, edge springs, and a cooling schedule. Runs a
 * fixed number of iterations inside a memo — no animation loop — which keeps the
 * render pure and avoids console errors from stray timers. O(n²) per iteration,
 * which is comfortable for the ≤100 relationships a single page fetches.
 */
function computeLayout(graph: Graph): Layout {
	const { edges, nodes } = graph;
	const positions = new Map<number, Point>();
	const count = nodes.length;
	if (count === 0) {
		return { bounds: computeBounds(positions), positions };
	}

	const centreX = CANVAS_WIDTH / 2;
	const centreY = CANVAS_HEIGHT / 2;
	const seedRadius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.4;
	nodes.forEach((node, index) => {
		const angle = (2 * Math.PI * index) / count;
		positions.set(node.id, {
			x: centreX + seedRadius * Math.cos(angle),
			y: centreY + seedRadius * Math.sin(angle),
		});
	});

	if (count === 1) {
		return { bounds: computeBounds(positions), positions };
	}

	const idealEdge = Math.max(70, Math.min(240, 1500 / Math.sqrt(count)));
	const repulsion = idealEdge * idealEdge * 0.9;

	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const displacement = new Map<number, Point>();
		for (const node of nodes) displacement.set(node.id, { x: 0, y: 0 });

		for (let i = 0; i < count; i += 1) {
			const nodeI = nodes[i];
			if (!nodeI) continue;
			const a = positions.get(nodeI.id) as Point;
			const da = displacement.get(nodeI.id) as Point;
			for (let j = i + 1; j < count; j += 1) {
				const nodeJ = nodes[j];
				if (!nodeJ) continue;
				const b = positions.get(nodeJ.id) as Point;
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
				const force = repulsion / (distance * distance);
				const fx = (dx / distance) * force;
				const fy = (dy / distance) * force;
				da.x += fx;
				da.y += fy;
				const db = displacement.get(nodeJ.id) as Point;
				db.x -= fx;
				db.y -= fy;
			}
		}

		for (const edge of edges) {
			const a = positions.get(edge.source);
			const b = positions.get(edge.target);
			if (!a || !b) continue;
			const dx = a.x - b.x;
			const dy = a.y - b.y;
			const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
			const force = (distance - idealEdge) * 0.08;
			const fx = (dx / distance) * force;
			const fy = (dy / distance) * force;
			const da = displacement.get(edge.source) as Point;
			const db = displacement.get(edge.target) as Point;
			da.x -= fx;
			da.y -= fy;
			db.x += fx;
			db.y += fy;
		}

		const cooling = 1 - iteration / ITERATIONS;
		const maxStep = 30 * cooling + 2;
		for (const node of nodes) {
			const disp = displacement.get(node.id) as Point;
			const length = Math.sqrt(disp.x * disp.x + disp.y * disp.y) || 0.01;
			const step = Math.min(length, maxStep);
			const point = positions.get(node.id) as Point;
			point.x += (disp.x / length) * step;
			point.y += (disp.y / length) * step;
		}
	}

	return { bounds: computeBounds(positions), positions };
}

export { computeLayout };
export type { Layout };

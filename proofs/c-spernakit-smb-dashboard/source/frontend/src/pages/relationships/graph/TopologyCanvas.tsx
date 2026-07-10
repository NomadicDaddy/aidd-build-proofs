import { Minus, Plus, Scan } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { assetTypeIcon, assetTypeLabel } from '@/pages/assets/assetDisplay';

import type { Layout } from './graphLayout';
import type { Graph } from './graphTypes';

import { assetTypeColor, relationshipTypeColor } from './graphDisplay';

interface ViewBox {
	height: number;
	width: number;
	x: number;
	y: number;
}

interface TopologyCanvasProps {
	focusId: null | number;
	graph: Graph;
	layout: Layout;
	onSelect: (id: null | number) => void;
	selectedId: null | number;
}

/** Node circle radius grows slightly with connectedness so hubs stand out. */
function nodeRadius(degree: number): number {
	return Math.min(30, 16 + Math.sqrt(degree) * 2.5);
}

/**
 * Pannable, zoomable SVG rendering of the topology graph. Edges are drawn as
 * directional arrows coloured by relationship type; nodes are asset-type-coloured
 * discs with the matching icon and a label. Selecting a node highlights its
 * incident edges and dims the rest. Pan by dragging the background, zoom with the
 * wheel or the on-canvas controls; "fit" restores the framing to the full graph.
 */
function TopologyCanvas({ focusId, graph, layout, onSelect, selectedId }: TopologyCanvasProps) {
	const svgRef = useRef<null | SVGSVGElement>(null);
	const panState = useRef<{ moved: boolean; x: number; y: number } | null>(null);

	const initialViewBox = useMemo<ViewBox>(
		() => ({
			height: layout.bounds.height,
			width: layout.bounds.width,
			x: layout.bounds.x,
			y: layout.bounds.y,
		}),
		[layout.bounds]
	);
	const [viewBox, setViewBox] = useState<ViewBox>(initialViewBox);

	// Reframe when the displayed graph (and therefore its bounds) changes. Done by
	// adjusting state during render (React's recommended pattern) rather than in an
	// effect, so there is no cascading-render round-trip.
	const [framedBounds, setFramedBounds] = useState(initialViewBox);
	if (framedBounds !== initialViewBox) {
		setFramedBounds(initialViewBox);
		setViewBox(initialViewBox);
	}

	const incidentEdgeIds = useMemo(() => {
		if (selectedId === null) return null;
		const ids = new Set<number>();
		for (const edge of graph.edges) {
			if (edge.source === selectedId || edge.target === selectedId) ids.add(edge.id);
		}
		return ids;
	}, [graph.edges, selectedId]);

	const neighbourIds = useMemo(() => {
		if (selectedId === null) return null;
		const ids = new Set<number>([selectedId]);
		for (const edge of graph.edges) {
			if (edge.source === selectedId) ids.add(edge.target);
			if (edge.target === selectedId) ids.add(edge.source);
		}
		return ids;
	}, [graph.edges, selectedId]);

	const zoom = useCallback((factor: number, centre?: { x: number; y: number }) => {
		setViewBox((current) => {
			const width = Math.max(120, Math.min(current.width * factor, 12000));
			const height = (width / current.width) * current.height;
			const anchorX = centre ? centre.x : current.x + current.width / 2;
			const anchorY = centre ? centre.y : current.y + current.height / 2;
			const ratio = width / current.width;
			return {
				height,
				width,
				x: anchorX - (anchorX - current.x) * ratio,
				y: anchorY - (anchorY - current.y) * ratio,
			};
		});
	}, []);

	const toSvgPoint = useCallback((clientX: number, clientY: number, box: ViewBox) => {
		const svg = svgRef.current;
		if (!svg) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		const rect = svg.getBoundingClientRect();
		return {
			x: box.x + ((clientX - rect.left) / rect.width) * box.width,
			y: box.y + ((clientY - rect.top) / rect.height) * box.height,
		};
	}, []);

	const handleWheel = useCallback(
		(event: React.WheelEvent<SVGSVGElement>) => {
			event.preventDefault();
			const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
			const centre = toSvgPoint(event.clientX, event.clientY, viewBox);
			zoom(factor, centre);
		},
		[toSvgPoint, viewBox, zoom]
	);

	const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
		panState.current = { moved: false, x: event.clientX, y: event.clientY };
		event.currentTarget.setPointerCapture(event.pointerId);
	}, []);

	const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
		const pan = panState.current;
		if (!pan) return;
		const svg = svgRef.current;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		setViewBox((current) => {
			const dx = ((event.clientX - pan.x) / rect.width) * current.width;
			const dy = ((event.clientY - pan.y) / rect.height) * current.height;
			return { ...current, x: current.x - dx, y: current.y - dy };
		});
		pan.moved = true;
		pan.x = event.clientX;
		pan.y = event.clientY;
	}, []);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			const pan = panState.current;
			panState.current = null;
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			// A click on empty canvas (no drag) clears the selection.
			if (pan && !pan.moved) onSelect(null);
		},
		[onSelect]
	);

	return (
		<div className="relative h-full w-full">
			<div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
				<Button
					aria-label="Zoom in"
					onClick={() => zoom(1 / 1.25)}
					size="icon-sm"
					variant="outline">
					<Plus />
				</Button>
				<Button
					aria-label="Zoom out"
					onClick={() => zoom(1.25)}
					size="icon-sm"
					variant="outline">
					<Minus />
				</Button>
				<Button
					aria-label="Fit graph to view"
					onClick={() => setViewBox(initialViewBox)}
					size="icon-sm"
					variant="outline">
					<Scan />
				</Button>
			</div>
			<svg
				aria-label="Infrastructure dependency map"
				className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onWheel={handleWheel}
				ref={svgRef}
				role="img"
				viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}>
				<defs>
					<marker
						id="topology-arrow"
						markerHeight="6"
						markerWidth="6"
						orient="auto-start-reverse"
						refX="5.5"
						refY="3"
						viewBox="0 0 6 6">
						<path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
					</marker>
				</defs>

				{graph.edges.map((edge) => {
					const from = layout.positions.get(edge.source);
					const to = layout.positions.get(edge.target);
					if (!from || !to) return null;
					const dimmed = incidentEdgeIds !== null && !incidentEdgeIds.has(edge.id);
					const color = relationshipTypeColor(edge.relationshipType);
					const targetRadius = nodeRadius(
						graph.nodes.find((n) => n.id === edge.target)?.degree ?? 0
					);
					const angle = Math.atan2(to.y - from.y, to.x - from.x);
					const endX = to.x - Math.cos(angle) * targetRadius;
					const endY = to.y - Math.sin(angle) * targetRadius;
					return (
						<line
							key={edge.id}
							markerEnd="url(#topology-arrow)"
							opacity={dimmed ? 0.12 : 0.75}
							stroke={color}
							strokeWidth={2}
							style={{ color }}
							x1={from.x}
							x2={endX}
							y1={from.y}
							y2={endY}
						/>
					);
				})}

				{graph.nodes.map((node) => {
					const point = layout.positions.get(node.id);
					if (!point) return null;
					const radius = nodeRadius(node.degree);
					const Icon = assetTypeIcon(node.assetType ?? 'other');
					const isSelected = node.id === selectedId;
					const isFocus = node.id === focusId;
					const dimmed = neighbourIds !== null && !neighbourIds.has(node.id);
					const iconSize = Math.round(radius);
					return (
						<g
							className="cursor-pointer"
							key={node.id}
							onClick={(event) => {
								event.stopPropagation();
								onSelect(node.id);
							}}
							onPointerDown={(event) => event.stopPropagation()}
							opacity={dimmed ? 0.3 : 1}
							transform={`translate(${point.x} ${point.y})`}>
							<title>{`${node.name} — ${assetTypeLabel(node.assetType ?? 'other')}`}</title>
							<circle
								fill={assetTypeColor(node.assetType)}
								r={radius}
								stroke={isSelected || isFocus ? '#0f172a' : '#ffffff'}
								strokeWidth={isSelected ? 4 : isFocus ? 3 : 1.5}
							/>
							<Icon
								color="#ffffff"
								height={iconSize}
								width={iconSize}
								x={-iconSize / 2}
								y={-iconSize / 2}
							/>
							<text
								className="fill-foreground"
								fontSize={13}
								fontWeight={isSelected || isFocus ? 700 : 500}
								textAnchor="middle"
								y={radius + 16}>
								{node.name}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}

export { TopologyCanvas };

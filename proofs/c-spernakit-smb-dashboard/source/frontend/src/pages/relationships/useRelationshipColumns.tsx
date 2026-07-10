import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Relationship } from '@/api/relationships';

import { Badge } from '@/components/ui/badge';

import { confidenceLabel, confidenceVariant, relationshipTypeLabel } from './relationshipDisplay';

/** Link to an asset's detail page, falling back to a `#id` token when unnamed. */
function assetLink(id: number, name: null | string) {
	return (
		<Link className="text-foreground font-medium hover:underline" to={`/assets/${id}`}>
			{name ?? `#${id}`}
		</Link>
	);
}

/**
 * Deep-link to an endpoint asset's impact analysis (the Relationships tab of its
 * detail page), so an operator can jump from any edge straight to "what breaks if
 * this asset is offline?".
 */
function impactLink(id: number, label: string) {
	return (
		<Link
			className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
			to={`/assets/${id}?tab=relationships`}>
			<Zap aria-hidden="true" className="size-3.5" />
			{label}
		</Link>
	);
}

/**
 * Column definitions for the relationship table view: the directed source →
 * target endpoints (each linking to its asset), the relationship type, the
 * confidence rating, and notes. This is the accessible, filterable equivalent
 * of the relationship graph — every edge is one row.
 */
export function useRelationshipColumns() {
	const columns: ColumnDef<Relationship, unknown>[] = [
		{
			accessorKey: 'relationshipType',
			cell: ({ row }) => (
				<Badge variant="outline">
					{relationshipTypeLabel(row.original.relationshipType)}
				</Badge>
			),
			header: 'Type',
		},
		{
			cell: ({ row }) => (
				<span className="flex items-center gap-2">
					{assetLink(row.original.sourceAssetId, row.original.sourceAssetName)}
					<ArrowRight
						aria-label="relates to"
						className="text-muted-foreground size-4 shrink-0"
					/>
					{assetLink(row.original.targetAssetId, row.original.targetAssetName)}
				</span>
			),
			header: 'Direction (source → target)',
			id: 'direction',
		},
		{
			accessorKey: 'sourceAssetName',
			cell: ({ row }) => assetLink(row.original.sourceAssetId, row.original.sourceAssetName),
			header: 'Source',
		},
		{
			accessorKey: 'targetAssetName',
			cell: ({ row }) => assetLink(row.original.targetAssetId, row.original.targetAssetName),
			header: 'Target',
		},
		{
			accessorKey: 'confidence',
			cell: ({ row }) => (
				<Badge variant={confidenceVariant(row.original.confidence)}>
					{confidenceLabel(row.original.confidence)}
				</Badge>
			),
			header: 'Confidence',
		},
		{
			accessorKey: 'notes',
			cell: ({ row }) =>
				row.original.notes ? (
					<span className="line-clamp-2 max-w-xs">{row.original.notes}</span>
				) : (
					<span className="text-muted-foreground">—</span>
				),
			header: 'Notes',
		},
		{
			cell: ({ row }) => (
				<span className="flex flex-col gap-1">
					{impactLink(row.original.sourceAssetId, 'Source')}
					{impactLink(row.original.targetAssetId, 'Target')}
				</span>
			),
			header: 'Impact',
			id: 'impact',
		},
	];

	return columns;
}

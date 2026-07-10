import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Asset } from '@/api/assets';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormatters } from '@/hooks/useFormatters';

import {
	assetStatusLabel,
	assetStatusVariant,
	assetTypeIcon,
	assetTypeLabel,
	criticalityLabel,
	criticalityVariant,
} from './assetDisplay';

/** Render a nullable text cell, falling back to an em dash. */
function textCell(value: null | string) {
	return value ? <span>{value}</span> : <span className="text-muted-foreground">—</span>;
}

/** Render a foreign-key reference id as a readable token, or an em dash. */
function refCell(label: string, id: null | number) {
	return id === null ? (
		<span className="text-muted-foreground">—</span>
	) : (
		<span>{`${label} #${id}`}</span>
	);
}

interface AssetColumnsProps {
	canWrite: boolean;
	onDelete: (asset: Asset) => void;
	onEdit: (asset: Asset) => void;
}

/**
 * Column definitions for the asset inventory table. The name cell links to the
 * asset detail page; the trailing actions column (edit / soft-delete) is only
 * rendered for OPERATOR+ users.
 */
export function useAssetColumns({ canWrite, onDelete, onEdit }: AssetColumnsProps) {
	const { formatDate } = useFormatters();

	const columns: ColumnDef<Asset, unknown>[] = [
		{
			accessorKey: 'name',
			cell: ({ row }) => (
				<Link
					className="text-foreground font-medium hover:underline"
					to={`/assets/${row.original.id}`}>
					{row.original.name}
				</Link>
			),
			header: 'Name',
		},
		{
			accessorKey: 'assetType',
			cell: ({ row }) => {
				const Icon = assetTypeIcon(row.original.assetType);
				return (
					<span className="flex items-center gap-2">
						<Icon
							aria-hidden="true"
							className="text-muted-foreground size-4 shrink-0"
						/>
						<span className="truncate">{assetTypeLabel(row.original.assetType)}</span>
					</span>
				);
			},
			header: 'Type',
		},
		{
			accessorKey: 'status',
			cell: ({ row }) => (
				<Badge variant={assetStatusVariant(row.original.status)}>
					{assetStatusLabel(row.original.status)}
				</Badge>
			),
			header: 'Status',
		},
		{
			accessorKey: 'siteId',
			cell: ({ row }) => refCell('Site', row.original.siteId),
			header: 'Site',
		},
		{
			accessorKey: 'businessOwnerId',
			cell: ({ row }) => refCell('Owner', row.original.businessOwnerId),
			header: 'Owner',
		},
		{
			accessorKey: 'role',
			cell: ({ row }) => textCell(row.original.role),
			header: 'Role',
		},
		{
			accessorKey: 'operatingSystem',
			cell: ({ row }) => textCell(row.original.operatingSystem),
			header: 'OS',
		},
		{
			accessorKey: 'primaryIp',
			cell: ({ row }) =>
				row.original.primaryIp ? (
					<span className="font-mono text-xs">{row.original.primaryIp}</span>
				) : (
					<span className="text-muted-foreground">—</span>
				),
			header: 'IP',
		},
		{
			accessorKey: 'isVirtual',
			cell: ({ row }) => (
				<Badge variant="outline">{row.original.isVirtual ? 'Virtual' : 'Physical'}</Badge>
			),
			header: 'Virtualization',
		},
		{
			accessorKey: 'lastVerifiedAt',
			cell: ({ row }) =>
				row.original.lastVerifiedAt ? (
					formatDate(row.original.lastVerifiedAt)
				) : (
					<span className="text-muted-foreground">—</span>
				),
			header: 'Last Verified',
		},
		{
			accessorKey: 'criticality',
			cell: ({ row }) => (
				<Badge variant={criticalityVariant(row.original.criticality)}>
					{criticalityLabel(row.original.criticality)}
				</Badge>
			),
			header: 'Criticality',
		},
	];

	if (canWrite) {
		columns.push({
			cell: ({ row }) => {
				const asset = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button aria-label="Asset actions" size="icon" variant="ghost">
								<MoreHorizontal aria-hidden="true" className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEdit(asset)}>
								<Pencil aria-hidden="true" className="mr-2 size-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => onDelete(asset)}>
								<Trash2 aria-hidden="true" className="mr-2 size-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
			enableHiding: false,
			id: 'actions',
		});
	}

	return columns;
}

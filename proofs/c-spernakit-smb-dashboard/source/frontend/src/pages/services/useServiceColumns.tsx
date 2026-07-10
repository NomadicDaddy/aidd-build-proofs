import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Service } from '@/api/services';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { categoryLabel, criticalityLabel, criticalityVariant } from './serviceDisplay';

/** Render a nullable text cell, falling back to an em dash. */
function textCell(value: null | string) {
	return value ? <span>{value}</span> : <span className="text-muted-foreground">—</span>;
}

interface ServiceColumnsProps {
	canWrite: boolean;
	onDelete: (service: Service) => void;
	onEdit: (service: Service) => void;
}

/**
 * Column definitions for the service catalog table. The name cell links to the
 * service detail page; the trailing actions column (edit / soft-delete) is only
 * rendered for OPERATOR+ users.
 */
export function useServiceColumns({ canWrite, onDelete, onEdit }: ServiceColumnsProps) {
	const columns: ColumnDef<Service, unknown>[] = [
		{
			accessorKey: 'name',
			cell: ({ row }) => (
				<Link
					className="text-foreground font-medium hover:underline"
					to={`/services/${row.original.id}`}>
					{row.original.name}
				</Link>
			),
			header: 'Name',
		},
		{
			accessorKey: 'category',
			cell: ({ row }) =>
				row.original.category ? (
					<Badge variant="outline">{categoryLabel(row.original.category)}</Badge>
				) : (
					<span className="text-muted-foreground">—</span>
				),
			header: 'Category',
		},
		{
			accessorKey: 'ownerName',
			cell: ({ row }) => textCell(row.original.ownerName),
			header: 'Owner',
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
		{
			accessorKey: 'expectedAvailability',
			cell: ({ row }) => textCell(row.original.expectedAvailability),
			header: 'Availability',
		},
		{
			accessorKey: 'backingAssetCount',
			cell: ({ row }) => (
				<span className="tabular-nums">{row.original.backingAssetCount}</span>
			),
			header: 'Backing assets',
		},
	];

	if (canWrite) {
		columns.push({
			cell: ({ row }) => {
				const service = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button aria-label="Service actions" size="icon" variant="ghost">
								<MoreHorizontal aria-hidden="true" className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEdit(service)}>
								<Pencil aria-hidden="true" className="mr-2 size-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => onDelete(service)}>
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

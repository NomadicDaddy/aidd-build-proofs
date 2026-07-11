import { Archive, Edit } from 'lucide-react';

import type { CostCatalogCategory, CostCatalogItem } from '@/api/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatPercent } from '@/lib/pricingFormatters';

const CATEGORY_LABELS: Record<CostCatalogCategory, string> = {
	fee: 'Fee',
	labor: 'Labor',
	material: 'Material',
	other: 'Other',
	overhead: 'Overhead',
	subcontractor: 'Subcontractor',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
	currency: 'USD',
	style: 'currency',
});

function formatDate(value: null | string): string {
	if (!value) return 'Not set';
	return new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

interface CostCatalogTableProps {
	canEdit: boolean;
	catalogItems: CostCatalogItem[];
	onArchive: (id: number) => void;
	onEdit: (item: CostCatalogItem) => void;
	pending: boolean;
}

function CostCatalogTable({
	canEdit,
	catalogItems,
	onArchive,
	onEdit,
	pending,
}: CostCatalogTableProps) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Unit</TableHead>
						<TableHead className="text-right">Unit Cost</TableHead>
						<TableHead className="text-right">Markup</TableHead>
						<TableHead>Taxable</TableHead>
						<TableHead>Last Reviewed</TableHead>
						<TableHead className="w-[120px] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{catalogItems.map((item) => (
						<TableRow className={!item.active ? 'opacity-65' : undefined} key={item.id}>
							<TableCell>
								<div className="max-w-[18rem] min-w-0">
									<div className="truncate font-medium">{item.name}</div>
									{item.notes && (
										<div className="text-muted-foreground truncate text-xs">
											{item.notes}
										</div>
									)}
								</div>
							</TableCell>
							<TableCell>
								<Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
							</TableCell>
							<TableCell>{item.unit}</TableCell>
							<TableCell className="text-right">
								{currencyFormatter.format(item.unitCost)}
							</TableCell>
							<TableCell className="text-right">
								{formatPercent(item.defaultMarkupPercent)}
							</TableCell>
							<TableCell>{item.taxable ? 'Yes' : 'No'}</TableCell>
							<TableCell>{formatDate(item.lastReviewedAt)}</TableCell>
							<TableCell>
								<div className="flex justify-end gap-1">
									<Button
										aria-label={`Edit ${item.name}`}
										disabled={!canEdit || pending}
										onClick={() => onEdit(item)}
										size="icon"
										type="button"
										variant="ghost">
										<Edit aria-hidden="true" className="size-4" />
									</Button>
									<Button
										aria-label={`Archive ${item.name}`}
										disabled={!canEdit || pending || !item.active}
										onClick={() => onArchive(item.id)}
										size="icon"
										type="button"
										variant="ghost">
										<Archive aria-hidden="true" className="size-4" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
					{catalogItems.length === 0 && (
						<TableRow>
							<TableCell className="h-28 text-center" colSpan={8}>
								<div className="text-muted-foreground text-sm">
									No catalog items match the current filters.
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}

export { CostCatalogTable };

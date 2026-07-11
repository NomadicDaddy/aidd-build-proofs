import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type {
	CostCatalogCategory,
	CostCatalogItem,
	CostCatalogItemInput,
	CostCatalogItemUpdateInput,
} from '@/api/types';

import {
	archiveCostCatalogItem,
	createCostCatalogItem,
	listCostCatalogItems,
	updateCostCatalogItem,
} from '@/api/costCatalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useAuthorization } from '@/hooks/useAuthorization';
import { cn } from '@/lib/utils';
import { CostCatalogDialog } from '@/pages/cost-catalog/components/CostCatalogDialog';
import { CostCatalogTable } from '@/pages/cost-catalog/components/CostCatalogTable';

const CATEGORIES: CostCatalogCategory[] = [
	'labor',
	'material',
	'subcontractor',
	'overhead',
	'fee',
	'other',
];

const CATEGORY_LABELS: Record<CostCatalogCategory, string> = {
	fee: 'Fee',
	labor: 'Labor',
	material: 'Material',
	other: 'Other',
	overhead: 'Overhead',
	subcontractor: 'Subcontractor',
};

function CostCatalogPage() {
	const { can } = useAuthorization();
	const canEdit = can('OPERATOR');
	const queryClient = useQueryClient();
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState<'all' | CostCatalogCategory>('all');
	const [includeArchived, setIncludeArchived] = useState(false);
	const [editingItem, setEditingItem] = useState<CostCatalogItem | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	const queryKey = useMemo(
		() => ['cost-catalog', { category, includeArchived, search }],
		[category, includeArchived, search]
	);

	const { data, isLoading } = useQuery({
		queryFn: () => {
			const trimmedSearch = search.trim();
			return listCostCatalogItems({
				category,
				includeArchived,
				...(trimmedSearch ? { search: trimmedSearch } : {}),
			});
		},
		queryKey,
	});

	const catalogItems = data?.data ?? [];

	const invalidateCatalog = () => {
		void queryClient.invalidateQueries({ queryKey: ['cost-catalog'] });
	};

	const createMutation = useMutation({
		mutationFn: (input: CostCatalogItemInput) => createCostCatalogItem(input),
		onError: () => {
			toast.error('Could not save catalog item');
		},
		onSuccess: () => {
			invalidateCatalog();
			setDialogOpen(false);
			toast.success('Catalog item saved');
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: CostCatalogItemUpdateInput }) =>
			updateCostCatalogItem(id, input),
		onError: () => {
			toast.error('Could not save catalog item');
		},
		onSuccess: () => {
			invalidateCatalog();
			setDialogOpen(false);
			setEditingItem(null);
			toast.success('Catalog item saved');
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: number) => archiveCostCatalogItem(id),
		onError: () => {
			toast.error('Could not archive catalog item');
		},
		onSuccess: () => {
			invalidateCatalog();
			toast.success('Catalog item archived');
		},
	});

	const pending =
		createMutation.isPending || updateMutation.isPending || archiveMutation.isPending;

	function openCreateDialog() {
		setEditingItem(null);
		setDialogOpen(true);
	}

	function openEditDialog(item: CostCatalogItem) {
		setEditingItem(item);
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingItem(null);
	}

	function toggleIncludeArchived() {
		setIncludeArchived((current) => !current);
	}

	return (
		<div className="space-y-5 p-6">
			<PageHeader
				description="Reusable labor, material, subcontractor, overhead, fee, and other assumptions."
				icon={Search}
				title="Cost Catalog">
				<Button disabled={!canEdit} onClick={openCreateDialog} type="button">
					<Plus aria-hidden="true" className="size-4" />
					New Item
				</Button>
			</PageHeader>

			<div className="flex flex-col gap-3 md:flex-row md:items-center">
				<div className="relative min-w-0 flex-1">
					<Search
						aria-hidden="true"
						className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						aria-label="Search cost catalog"
						className="pl-9"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search catalog"
						value={search}
					/>
				</div>
				<Select
					onValueChange={(value) => setCategory(value as 'all' | CostCatalogCategory)}
					value={category}>
					<SelectTrigger aria-label="Filter category" className="w-full md:w-[190px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All categories</SelectItem>
						{CATEGORIES.map((option) => (
							<SelectItem key={option} value={option}>
								{CATEGORY_LABELS[option]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<button
					aria-checked={includeArchived}
					className="hover:bg-accent flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors"
					onClick={toggleIncludeArchived}
					role="switch"
					type="button">
					<span
						aria-hidden="true"
						className={cn(
							'inline-flex h-3.5 w-6 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors',
							includeArchived ? 'bg-primary' : 'bg-input'
						)}>
						<span
							className={cn(
								'bg-background block size-3 rounded-full transition-transform',
								includeArchived && 'translate-x-2.5'
							)}
						/>
					</span>
					<span>Show archived catalog items</span>
				</button>
			</div>

			<CostCatalogTable
				canEdit={canEdit}
				catalogItems={catalogItems}
				onArchive={(id) => archiveMutation.mutate(id)}
				onEdit={openEditDialog}
				pending={pending}
			/>

			{isLoading && <div className="text-muted-foreground text-sm">Loading catalog...</div>}

			<CostCatalogDialog
				dialogOpen={dialogOpen}
				editingItem={editingItem}
				key={editingItem?.id ?? 'new'}
				onClose={closeDialog}
				onSubmitCreate={(input) => createMutation.mutate(input)}
				onSubmitUpdate={(args) => updateMutation.mutate(args)}
				pending={pending}
			/>
		</div>
	);
}

export { CostCatalogPage };

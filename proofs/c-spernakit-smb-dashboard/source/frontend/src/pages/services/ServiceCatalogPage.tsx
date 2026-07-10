import { Boxes, Plus } from 'lucide-react';
import { useState } from 'react';

import type { CreateServiceInput, Service } from '@/api/services';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices } from '@/hooks/services/useServices';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useUrlFilters } from '@/hooks/useUrlFilters';

import { ServiceFormDialog } from './ServiceFormDialog';
import { ServiceTableFilters } from './ServiceTableFilters';
import { useServiceColumns } from './useServiceColumns';

type DialogState =
	| { service: Service; type: 'delete' }
	| { service: Service; type: 'edit' }
	| { type: 'create' }
	| null;

/**
 * Searchable, filterable service catalog page. Consumes the paginated service
 * API through {@link useServices}, renders a data table (name links to the
 * detail page, showing owner / criticality / backing-asset coverage), and
 * exposes create / edit / soft-delete flows to OPERATOR+ users. Text search and
 * the category / criticality filters are synced to the URL.
 */
function ServiceCatalogPage() {
	const { getFilter, limit, page, setFilter, setLimit, setPage } = useUrlFilters(20);
	const search = getFilter('search');
	const category = getFilter('category');
	const criticality = getFilter('criticality');

	const [dialog, setDialog] = useState<DialogState>(null);

	const { isOperator } = useAuthorization();
	const canWrite = isOperator();

	const { createMutation, data, deleteMutation, isLoading, updateMutation } = useServices(
		page,
		limit,
		{ category, criticality, search }
	);

	const columns = useServiceColumns({
		canWrite,
		onDelete: (service) => setDialog({ service, type: 'delete' }),
		onEdit: (service) => setDialog({ service, type: 'edit' }),
	});

	const services = data?.data ?? [];
	const total = data?.total ?? 0;

	function closeDialog() {
		setDialog(null);
	}

	function handleSubmit(input: CreateServiceInput) {
		if (dialog?.type === 'edit') {
			updateMutation.mutate({ id: dialog.service.id, input }, { onSuccess: closeDialog });
		} else {
			createMutation.mutate(input, { onSuccess: closeDialog });
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader
				description="The catalog of business and technical services — ownership, criticality, and the assets that back each one."
				eyebrow="Catalog"
				icon={Boxes}
				title="Services">
				{canWrite && (
					<Button onClick={() => setDialog({ type: 'create' })} size="sm">
						<Plus aria-hidden="true" className="mr-2 size-4" />
						New Service
					</Button>
				)}
			</PageHeader>

			<ServiceTableFilters
				category={category}
				criticality={criticality}
				onCategoryChange={(value) => setFilter('category', value)}
				onCriticalityChange={(value) => setFilter('criticality', value)}
				onSearchChange={(value) => setFilter('search', value)}
				search={search}
			/>

			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			) : (
				<DataTable
					columns={columns}
					data={services}
					pagination={{
						limit,
						onPageChange: setPage,
						onPageSizeChange: setLimit,
						page,
						total,
					}}
				/>
			)}

			<ServiceFormDialog
				isOpen={dialog?.type === 'create' || dialog?.type === 'edit'}
				isPending={createMutation.isPending || updateMutation.isPending}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
				onSubmit={handleSubmit}
				service={dialog?.type === 'edit' ? dialog.service : null}
			/>

			<ConfirmAlertDialog
				confirmText="Delete"
				description={
					dialog?.type === 'delete'
						? `Soft-delete "${dialog.service.name}"? It can be restored later from the API.`
						: ''
				}
				isOpen={dialog?.type === 'delete'}
				isPending={deleteMutation.isPending}
				onConfirm={() => {
					if (dialog?.type === 'delete') {
						deleteMutation.mutate(dialog.service.id, { onSuccess: closeDialog });
					}
				}}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
				title="Delete Service"
			/>
		</div>
	);
}

export { ServiceCatalogPage };

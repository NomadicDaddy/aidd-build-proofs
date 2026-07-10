import { Plus, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SAVED_VIEW_FILTER_KEYS } from 'spernakit-shared';

import type { Asset, CreateAssetInput } from '@/api/assets';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssets } from '@/hooks/assets/useAssets';
import { useInfrastructureSettings } from '@/hooks/settings/useInfrastructureSettings';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useUrlFilters } from '@/hooks/useUrlFilters';

import { AssetFormDialog } from './AssetFormDialog';
import { AssetPortFilters } from './AssetPortFilters';
import { AssetTableFilters } from './AssetTableFilters';
import { SavedViewsBar } from './SavedViewsBar';
import { useAssetColumns } from './useAssetColumns';

type DialogState =
	{ asset: Asset; type: 'delete' } | { asset: Asset; type: 'edit' } | { type: 'create' } | null;

/**
 * Searchable, filterable asset inventory page. Consumes the paginated inventory
 * API through {@link useAssets}, renders a dense data table (name links to the
 * detail page), and exposes create / edit / soft-delete flows to OPERATOR+
 * users. Text search and the type / status / criticality filters are synced to
 * the URL so views are shareable and survive reloads.
 */
function AssetInventoryPage() {
	const { getFilter, limit, page, searchParams, setFilter, setFilters, setLimit, setPage } =
		useUrlFilters(20);
	const search = getFilter('search');
	const type = getFilter('type');
	const status = getFilter('status');
	const criticality = getFilter('criticality');
	const protocol = getFilter('protocol');
	const exposureLevel = getFilter('exposureLevel');
	const reviewState = getFilter('reviewState');
	const portNumber = getFilter('portNumber');
	const serviceId = getFilter('serviceId');

	const [dialog, setDialog] = useState<DialogState>(null);

	// Seed the inventory with the admin-configured default filter preset on first
	// visit — only when the user has not already chosen any of these filters.
	const { data: infraSettings } = useInfrastructureSettings();
	const seededDefaultsRef = useRef(false);
	useEffect(() => {
		if (seededDefaultsRef.current || !infraSettings) return;
		seededDefaultsRef.current = true;
		if (
			searchParams.has('status') ||
			searchParams.has('type') ||
			searchParams.has('criticality')
		) {
			return;
		}
		const preset = infraSettings.defaultDashboardFilters;
		if (!preset.status && !preset.assetType && !preset.criticality) return;
		setFilters((next) => {
			if (preset.status) next.set('status', preset.status);
			if (preset.assetType) next.set('type', preset.assetType);
			if (preset.criticality) next.set('criticality', preset.criticality);
		});
	}, [infraSettings, searchParams, setFilters]);

	// Reduce the active URL filters to just the keys a saved view persists, so the
	// save action captures exactly what a loaded view will restore.
	const currentFilters: Record<string, string> = {};
	for (const key of SAVED_VIEW_FILTER_KEYS) {
		const value = getFilter(key);
		if (value) currentFilters[key] = value;
	}

	// Load a saved view or seed preset: clear every saved-view filter key, then
	// apply the view's filters, resetting pagination to the first page.
	function applyView(filters: Record<string, string>) {
		setFilters((next) => {
			for (const key of SAVED_VIEW_FILTER_KEYS) next.delete(key);
			for (const [key, value] of Object.entries(filters)) next.set(key, value);
			next.delete('page');
		});
	}

	const { isOperator } = useAuthorization();
	const canWrite = isOperator();

	const { createMutation, data, deleteMutation, isLoading, updateMutation } = useAssets(
		page,
		limit,
		{
			criticality,
			exposureLevel,
			portNumber,
			protocol,
			reviewState,
			search,
			serviceId,
			status,
			type,
		}
	);

	const columns = useAssetColumns({
		canWrite,
		onDelete: (asset) => setDialog({ asset, type: 'delete' }),
		onEdit: (asset) => setDialog({ asset, type: 'edit' }),
	});

	const assets = data?.data ?? [];
	const total = data?.total ?? 0;

	function closeDialog() {
		setDialog(null);
	}

	function handleSubmit(input: CreateAssetInput) {
		if (dialog?.type === 'edit') {
			updateMutation.mutate({ id: dialog.asset.id, input }, { onSuccess: closeDialog });
		} else {
			createMutation.mutate(input, { onSuccess: closeDialog });
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader
				description="Browse, search, and manage every tracked infrastructure asset."
				eyebrow="Inventory"
				icon={Server}
				title="Assets">
				{canWrite && (
					<Button onClick={() => setDialog({ type: 'create' })} size="sm">
						<Plus aria-hidden="true" className="mr-2 size-4" />
						New Asset
					</Button>
				)}
			</PageHeader>

			<SavedViewsBar currentFilters={currentFilters} onApply={applyView} />

			<AssetTableFilters
				criticality={criticality}
				onCriticalityChange={(value) => setFilter('criticality', value)}
				onSearchChange={(value) => setFilter('search', value)}
				onStatusChange={(value) => setFilter('status', value)}
				onTypeChange={(value) => setFilter('type', value)}
				search={search}
				status={status}
				type={type}
			/>

			<AssetPortFilters
				exposureLevel={exposureLevel}
				onExposureLevelChange={(value) => setFilter('exposureLevel', value)}
				onPortNumberChange={(value) => setFilter('portNumber', value)}
				onProtocolChange={(value) => setFilter('protocol', value)}
				onReviewStateChange={(value) => setFilter('reviewState', value)}
				onServiceIdChange={(value) => setFilter('serviceId', value)}
				portNumber={portNumber}
				protocol={protocol}
				reviewState={reviewState}
				serviceId={serviceId}
			/>

			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			) : (
				<DataTable
					columns={columns}
					data={assets}
					pagination={{
						limit,
						onPageChange: setPage,
						onPageSizeChange: setLimit,
						page,
						total,
					}}
				/>
			)}

			<AssetFormDialog
				asset={dialog?.type === 'edit' ? dialog.asset : null}
				isOpen={dialog?.type === 'create' || dialog?.type === 'edit'}
				isPending={createMutation.isPending || updateMutation.isPending}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
				onSubmit={handleSubmit}
			/>

			<ConfirmAlertDialog
				confirmText="Delete"
				description={
					dialog?.type === 'delete'
						? `Soft-delete "${dialog.asset.name}"? It can be restored later from the API.`
						: ''
				}
				isOpen={dialog?.type === 'delete'}
				isPending={deleteMutation.isPending}
				onConfirm={() => {
					if (dialog?.type === 'delete') {
						deleteMutation.mutate(dialog.asset.id, { onSuccess: closeDialog });
					}
				}}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
				title="Delete Asset"
			/>
		</div>
	);
}

export { AssetInventoryPage };

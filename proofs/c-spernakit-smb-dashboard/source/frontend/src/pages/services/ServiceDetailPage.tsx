import { ArrowLeft, Boxes, Link2, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { CreateServiceInput, ServiceDependency } from '@/api/services';

import { ConfirmAlertDialog } from '@/components/shared/ConfirmAlertDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useService } from '@/hooks/services/useService';
import { useAuthorization } from '@/hooks/useAuthorization';
import { assetTypeLabel, criticalityLabel, criticalityVariant } from '@/pages/assets/assetDisplay';

import { AddDependencyDialog } from './AddDependencyDialog';
import { Field } from './serviceDetailHelpers.tsx';
import { dependencyTargetLabel } from './serviceDetailModel.ts';
import { categoryLabel } from './serviceDisplay';
import { ServiceFormDialog } from './ServiceFormDialog';

/**
 * Detail page for a single catalog service. Shows the service's facts, the
 * assets that back it (linking to each asset), and its dependencies on other
 * services and assets. OPERATOR+ users can edit the service and add / remove
 * dependencies.
 */
function ServiceDetailPage() {
	const { id } = useParams<{ id: string }>();
	const serviceId = Number(id);
	const {
		addDependencyMutation,
		data,
		isError,
		isLoading,
		removeDependencyMutation,
		updateMutation,
	} = useService(serviceId);

	const { isOperator } = useAuthorization();
	const canWrite = isOperator();

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isAddDepOpen, setIsAddDepOpen] = useState(false);
	const [removingDep, setRemovingDep] = useState<null | ServiceDependency>(null);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	if (isError || !data) {
		return (
			<EmptyState
				action={
					<Button asChild variant="outline">
						<Link to="/services">
							<ArrowLeft aria-hidden="true" className="mr-2 size-4" />
							Back to services
						</Link>
					</Button>
				}
				description="This service does not exist or has been removed."
				icon={Boxes}
				title="Service not found"
			/>
		);
	}

	const service = data.data;

	function handleEditSubmit(input: CreateServiceInput) {
		updateMutation.mutate(input, { onSuccess: () => setIsEditOpen(false) });
	}

	return (
		<div className="space-y-6">
			<PageHeader
				breadcrumbs={[{ label: 'Services', to: '/services' }, { label: service.name }]}
				description={service.description ?? 'No business purpose recorded.'}
				eyebrow="Service"
				icon={Boxes}
				title={service.name}>
				{canWrite && (
					<Button onClick={() => setIsEditOpen(true)} size="sm" variant="outline">
						<Pencil aria-hidden="true" className="mr-2 size-4" />
						Edit
					</Button>
				)}
			</PageHeader>

			<Card>
				<CardHeader>
					<CardTitle>Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Field
							label="Category"
							value={service.category ? categoryLabel(service.category) : '—'}
						/>
						<Field
							label="Criticality"
							value={
								<Badge variant={criticalityVariant(service.criticality)}>
									{criticalityLabel(service.criticality)}
								</Badge>
							}
						/>
						<Field label="Owner" value={service.ownerName} />
						<Field label="Vendor" value={service.vendorName} />
						<Field label="Expected availability" value={service.expectedAvailability} />
						<Field label="Backing assets" value={service.backingAssetCount} />
						<Field label="Notes" value={service.notes} />
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Server aria-hidden="true" className="size-4" />
						Backing assets
					</CardTitle>
				</CardHeader>
				<CardContent>
					{service.backingAssets.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No assets are assigned to this service yet.
						</p>
					) : (
						<ul className="divide-border divide-y">
							{service.backingAssets.map((asset) => (
								<li
									className="flex items-center justify-between gap-3 py-2"
									key={asset.assignmentId}>
									<div className="min-w-0">
										<Link
											className="text-foreground font-medium hover:underline"
											to={`/assets/${asset.assetId}`}>
											{asset.name ?? `Asset #${asset.assetId}`}
										</Link>
										<div className="text-muted-foreground text-xs">
											{asset.assetType
												? assetTypeLabel(asset.assetType)
												: '—'}
											{asset.role ? ` · ${asset.role}` : ''}
										</div>
									</div>
									{asset.isPrimary && <Badge variant="secondary">Primary</Badge>}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<CardTitle className="flex items-center gap-2">
						<Link2 aria-hidden="true" className="size-4" />
						Dependencies
					</CardTitle>
					{canWrite && (
						<Button onClick={() => setIsAddDepOpen(true)} size="sm" variant="outline">
							<Plus aria-hidden="true" className="mr-2 size-4" />
							Add dependency
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{service.dependencies.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							This service has no recorded dependencies.
						</p>
					) : (
						<ul className="divide-border divide-y">
							{service.dependencies.map((dep) => {
								const isAsset = dep.dependsOnAssetId !== null;
								const target = dependencyTargetLabel(dep);
								return (
									<li
										className="flex items-center justify-between gap-3 py-2"
										key={dep.id}>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<Badge variant="outline">
													{isAsset ? 'Asset' : 'Service'}
												</Badge>
												{isAsset ? (
													<Link
														className="text-foreground font-medium hover:underline"
														to={`/assets/${dep.dependsOnAssetId}`}>
														{target}
													</Link>
												) : (
													<Link
														className="text-foreground font-medium hover:underline"
														to={`/services/${dep.dependsOnServiceId}`}>
														{target}
													</Link>
												)}
											</div>
											{dep.dependencyType && (
												<div className="text-muted-foreground text-xs">
													{dep.dependencyType}
												</div>
											)}
										</div>
										{canWrite && (
											<Button
												aria-label={`Remove dependency on ${target}`}
												onClick={() => setRemovingDep(dep)}
												size="icon"
												variant="ghost">
												<Trash2 aria-hidden="true" className="size-4" />
											</Button>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			<ServiceFormDialog
				isOpen={isEditOpen}
				isPending={updateMutation.isPending}
				onOpenChange={setIsEditOpen}
				onSubmit={handleEditSubmit}
				service={service}
			/>

			<AddDependencyDialog
				isOpen={isAddDepOpen}
				isPending={addDependencyMutation.isPending}
				onOpenChange={setIsAddDepOpen}
				onSubmit={(input) =>
					addDependencyMutation.mutate(input, {
						onSuccess: () => setIsAddDepOpen(false),
					})
				}
				serviceId={serviceId}
			/>

			<ConfirmAlertDialog
				confirmText="Remove"
				description={
					removingDep
						? `Remove the dependency on ${dependencyTargetLabel(removingDep)}?`
						: ''
				}
				isOpen={removingDep !== null}
				isPending={removeDependencyMutation.isPending}
				onConfirm={() => {
					if (removingDep) {
						removeDependencyMutation.mutate(removingDep.id, {
							onSuccess: () => setRemovingDep(null),
						});
					}
				}}
				onOpenChange={(open) => {
					if (!open) setRemovingDep(null);
				}}
				title="Remove dependency"
			/>
		</div>
	);
}

export { ServiceDetailPage };

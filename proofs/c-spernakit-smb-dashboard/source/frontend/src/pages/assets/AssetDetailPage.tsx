import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Network } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '@/api/apiError';
import { getAsset, type Asset } from '@/api/assets';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/skeletons/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHardwareProfile, useUpdateHardwareProfile } from '@/hooks/assets/useHardwareProfile';
import { useAuthorization } from '@/hooks/useAuthorization';

import { AssignedServicesSection } from './AssetDetailPage/AssignedServicesSection.tsx';
import { HTTP_STATUS_NOT_FOUND, formatRef } from './AssetDetailPage/formatters.ts';
import { HardwareTab } from './AssetDetailPage/HardwareTab.tsx';
import { NetworkInterfacesSection } from './AssetDetailPage/NetworkInterfacesSection.tsx';
import { NotesTab } from './AssetDetailPage/NotesTab.tsx';
import { OverviewTab } from './AssetDetailPage/OverviewTab.tsx';
import { PortsSection } from './AssetDetailPage/PortsSection.tsx';
import {
	AssetNotFound,
	Field,
	FieldGrid,
	IconBadge,
	SectionCard,
} from './AssetDetailPage/primitives.tsx';
import {
	StorageAllocationsSection,
	StorageConsumersSection,
} from './AssetDetailPage/StorageSections.tsx';
import { VirtualizationTab } from './AssetDetailPage/VirtualizationTab.tsx';
import {
	assetStatusLabel,
	assetStatusVariant,
	assetTypeIcon,
	assetTypeLabel,
	criticalityLabel,
	criticalityVariant,
} from './assetDisplay.ts';
import { AssetHistorySection } from './AssetHistorySection.tsx';
import { HardwareProfileDialog } from './HardwareProfileDialog.tsx';
import { ImpactAnalysisSection } from './ImpactAnalysisSection.tsx';

const TAB_TRIGGERS: { label: string; value: string }[] = [
	{ label: 'Overview', value: 'overview' },
	{ label: 'Hardware', value: 'hardware' },
	{ label: 'Virtualization', value: 'virtualization' },
	{ label: 'Storage', value: 'storage' },
	{ label: 'Network', value: 'network' },
	{ label: 'Services', value: 'services' },
	{ label: 'Ports', value: 'ports' },
	{ label: 'Relationships', value: 'relationships' },
	{ label: 'Notes', value: 'notes' },
	{ label: 'History', value: 'history' },
];

/** The default tab shown when no `?tab=` query param selects a valid tab. */
const DEFAULT_TAB = 'overview';

export function AssetDetailPage() {
	const { id } = useParams<{ id: string }>();
	const assetId = Number(id);
	const isValidId = Number.isInteger(assetId) && assetId > 0;

	// OPERATOR+ may see the sensitive fields (management URL, support contact,
	// operator notes) and edit the hardware profile; VIEWER-level users get the
	// sensitive fields redacted by the API and cannot edit.
	const { isOperator } = useAuthorization();
	const canSeeSensitive = isOperator();
	const canEdit = isOperator();

	// The active tab is synced to a `?tab=` query param so links (e.g. the "Impact"
	// action on the relationships table) can deep-link straight to a section and
	// the view stays shareable across reloads.
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedTab = searchParams.get('tab');
	const activeTab = TAB_TRIGGERS.some((tab) => tab.value === requestedTab)
		? (requestedTab as string)
		: DEFAULT_TAB;

	function handleTabChange(value: string) {
		setSearchParams(
			(previous) => {
				const next = new URLSearchParams(previous);
				if (value === DEFAULT_TAB) {
					next.delete('tab');
				} else {
					next.set('tab', value);
				}
				return next;
			},
			{ replace: true }
		);
	}

	const [isProfileDialogOpen, setProfileDialogOpen] = useState(false);
	const profileQuery = useHardwareProfile(assetId, isValidId);
	const profile = profileQuery.data?.data ?? null;
	const updateProfile = useUpdateHardwareProfile(assetId);

	const {
		data: asset,
		isError,
		isLoading,
	} = useQuery<Asset, Error>({
		enabled: isValidId,
		queryFn: async () => {
			const res = await getAsset(assetId);
			return res.data;
		},
		queryKey: ['asset', assetId],
		// A missing asset is an expected state for a detail page, not an
		// exceptional error: render the tailored not-found panel instead of
		// retrying and escalating to the global error boundary.
		retry: (failureCount, error) => {
			if (error instanceof ApiError && error.status === HTTP_STATUS_NOT_FOUND) return false;
			return failureCount < 3;
		},
		throwOnError: (error) =>
			!(error instanceof ApiError && error.status === HTTP_STATUS_NOT_FOUND),
	});

	if (!isValidId) {
		return (
			<div className="space-y-6 p-6">
				<AssetNotFound />
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="space-y-6 p-6">
				<PageHeader
					breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: 'Loading…' }]}
					title="Loading asset…"
				/>
				<TableSkeleton />
			</div>
		);
	}

	if (isError || !asset) {
		return (
			<div className="space-y-6 p-6">
				<AssetNotFound />
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			<PageHeader
				breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: asset.name }]}
				description={asset.hostname ?? asset.fqdn ?? assetTypeLabel(asset.assetType)}
				icon={assetTypeIcon(asset.assetType)}
				title={asset.name}>
				<Button asChild variant="outline">
					<Link to="/assets">
						<ArrowLeft aria-hidden="true" className="size-4" />
						Back to inventory
					</Link>
				</Button>
			</PageHeader>

			{/* Immediate identity strip: type, role, owner, criticality, status. */}
			<div className="flex flex-wrap items-center gap-2">
				<IconBadge
					icon={assetTypeIcon(asset.assetType)}
					label={assetTypeLabel(asset.assetType)}
				/>
				<Badge variant={assetStatusVariant(asset.status)}>
					{assetStatusLabel(asset.status)}
				</Badge>
				<Badge variant={criticalityVariant(asset.criticality)}>
					{criticalityLabel(asset.criticality)} criticality
				</Badge>
				<Badge variant="outline">{asset.isVirtual ? 'Virtual' : 'Physical'}</Badge>
				{asset.role && <Badge variant="outline">{asset.role}</Badge>}
				{asset.isDeleted && <Badge variant="destructive">Deleted</Badge>}
			</div>

			<Tabs className="gap-4" onValueChange={handleTabChange} value={activeTab}>
				<TabsList className="flex-wrap">
					{TAB_TRIGGERS.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>

				<TabsContent className="space-y-4" value="overview">
					<OverviewTab asset={asset} canSeeSensitive={canSeeSensitive} />
				</TabsContent>

				<TabsContent className="space-y-4" value="hardware">
					<HardwareTab
						asset={asset}
						canEdit={canEdit}
						onEditProfile={() => setProfileDialogOpen(true)}
						profile={profile}
					/>
				</TabsContent>

				<TabsContent className="space-y-4" value="virtualization">
					<VirtualizationTab
						asset={asset}
						canEdit={canEdit}
						onEditProfile={() => setProfileDialogOpen(true)}
						profile={profile}
					/>
				</TabsContent>

				<TabsContent className="space-y-4" value="storage">
					<StorageAllocationsSection
						assetId={assetId}
						canEdit={canEdit}
						enabled={isValidId}
					/>
					<StorageConsumersSection assetId={assetId} enabled={isValidId} />
				</TabsContent>

				<TabsContent className="space-y-4" value="network">
					<SectionCard
						description="Primary addressing recorded on the asset."
						icon={Network}
						title="Network & addressing">
						<FieldGrid>
							<Field label="Hostname" value={asset.hostname} />
							<Field label="FQDN" value={asset.fqdn} />
							<Field label="Primary IP" value={asset.primaryIp} />
							<Field
								label="Network zone"
								value={formatRef('Zone', asset.networkZoneId)}
							/>
							<Field label="Site" value={formatRef('Site', asset.siteId)} />
						</FieldGrid>
					</SectionCard>
					<NetworkInterfacesSection
						assetId={assetId}
						canEdit={canEdit}
						enabled={isValidId}
					/>
				</TabsContent>

				<TabsContent className="space-y-4" value="services">
					<AssignedServicesSection
						assetId={assetId}
						canEdit={canEdit}
						enabled={isValidId}
					/>
				</TabsContent>

				<TabsContent className="space-y-4" value="ports">
					<PortsSection assetId={assetId} canEdit={canEdit} enabled={isValidId} />
				</TabsContent>

				<TabsContent className="space-y-4" value="relationships">
					<ImpactAnalysisSection assetId={assetId} enabled={isValidId} />
				</TabsContent>

				<TabsContent className="space-y-4" value="notes">
					<NotesTab asset={asset} canSeeSensitive={canSeeSensitive} />
				</TabsContent>

				<TabsContent className="space-y-4" value="history">
					<AssetHistorySection assetId={assetId} enabled={isValidId} />
				</TabsContent>
			</Tabs>

			{canEdit && (
				<HardwareProfileDialog
					isOpen={isProfileDialogOpen}
					isPending={updateProfile.isPending}
					onOpenChange={setProfileDialogOpen}
					onSubmit={(input) =>
						updateProfile.mutate(input, {
							onSuccess: () => setProfileDialogOpen(false),
						})
					}
					profile={profile}
				/>
			)}
		</div>
	);
}

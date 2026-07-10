import type { VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import type { AssetStatus, AssetType, CriticalityLevel } from 'spernakit-shared';

import {
	Archive,
	Boxes,
	Building2,
	Database,
	HardDrive,
	Network,
	Router,
	Server,
	ServerCog,
	Shield,
	Workflow,
} from 'lucide-react';

import { type badgeVariants } from '@/components/ui/badge';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/** Human-readable label for each asset type. */
const ASSET_TYPE_LABELS: Record<AssetType, string> = {
	application_endpoint: 'Application / Service Endpoint',
	backup_target: 'Backup Target',
	business_service: 'Business Service',
	firewall_router: 'Firewall / Router',
	hypervisor_host: 'Hypervisor Host',
	network_device: 'Network Device',
	other: 'Other Infrastructure',
	physical_server: 'Physical Server',
	storage_appliance: 'Storage Appliance',
	storage_volume: 'Storage Pool / Volume',
	virtual_machine: 'Virtual Machine',
};

/** Icon used to represent each asset type across detail and inventory views. */
const ASSET_TYPE_ICONS: Record<AssetType, LucideIcon> = {
	application_endpoint: Workflow,
	backup_target: Archive,
	business_service: Building2,
	firewall_router: Shield,
	hypervisor_host: ServerCog,
	network_device: Network,
	other: Boxes,
	physical_server: Server,
	storage_appliance: Database,
	storage_volume: HardDrive,
	virtual_machine: Server,
};

/** Fallback icon for unknown/unmapped asset types. */
const DEFAULT_ASSET_ICON: LucideIcon = Router;

/** Human-readable label for each lifecycle status. */
const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
	active: 'Active',
	decommissioned: 'Decommissioned',
	maintenance: 'Maintenance',
	planned: 'Planned',
	retired: 'Retired',
	unknown: 'Unknown',
};

/** Badge styling for each lifecycle status. */
const ASSET_STATUS_VARIANTS: Record<AssetStatus, BadgeVariant> = {
	active: 'default',
	decommissioned: 'outline',
	maintenance: 'secondary',
	planned: 'secondary',
	retired: 'outline',
	unknown: 'outline',
};

/** Human-readable label for each criticality level. */
const CRITICALITY_LABELS: Record<CriticalityLevel, string> = {
	critical: 'Critical',
	high: 'High',
	low: 'Low',
	medium: 'Medium',
	unknown: 'Unknown',
};

/** Badge styling for each criticality level. */
const CRITICALITY_VARIANTS: Record<CriticalityLevel, BadgeVariant> = {
	critical: 'destructive',
	high: 'destructive',
	low: 'outline',
	medium: 'secondary',
	unknown: 'outline',
};

function assetTypeLabel(type: AssetType): string {
	return ASSET_TYPE_LABELS[type] ?? type;
}

function assetTypeIcon(type: AssetType): LucideIcon {
	return ASSET_TYPE_ICONS[type] ?? DEFAULT_ASSET_ICON;
}

function assetStatusLabel(status: AssetStatus): string {
	return ASSET_STATUS_LABELS[status] ?? status;
}

function assetStatusVariant(status: AssetStatus): BadgeVariant {
	return ASSET_STATUS_VARIANTS[status] ?? 'outline';
}

function criticalityLabel(level: CriticalityLevel): string {
	return CRITICALITY_LABELS[level] ?? level;
}

function criticalityVariant(level: CriticalityLevel): BadgeVariant {
	return CRITICALITY_VARIANTS[level] ?? 'outline';
}

export {
	assetStatusLabel,
	assetStatusVariant,
	assetTypeIcon,
	assetTypeLabel,
	criticalityLabel,
	criticalityVariant,
};

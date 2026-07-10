import type { RequirableAssetField } from 'spernakit-shared';

import { type IMPORT_DUPLICATE_STRATEGIES } from 'spernakit-shared';

import type { InfrastructureSettings } from '@/api/infrastructureSettings';

/** Sentinel used for the "no default" option in the nullable filter selects. */
export const ANY = '__any__';

export type DashboardFilters = InfrastructureSettings['defaultDashboardFilters'];

/** Human-readable labels for the fields an admin can require at manual entry. */
export const REQUIRABLE_FIELD_LABELS: Record<RequirableAssetField, string> = {
	assetTag: 'Asset Tag',
	businessOwnerId: 'Business Owner',
	criticality: 'Criticality',
	description: 'Description',
	documentationUrl: 'Documentation URL',
	fqdn: 'FQDN',
	hostname: 'Hostname',
	managementUrl: 'Management URL',
	networkZoneId: 'Network Zone',
	operatingSystem: 'Operating System',
	osVersion: 'OS Version',
	platform: 'Platform',
	primaryIp: 'Primary IP',
	role: 'Role',
	serialNumber: 'Serial Number',
	siteId: 'Site',
	supportContact: 'Support Contact',
	technicalOwnerId: 'Technical Owner',
	vendorId: 'Vendor',
};

export const DUPLICATE_STRATEGY_LABELS: Record<
	(typeof IMPORT_DUPLICATE_STRATEGIES)[number],
	string
> = {
	review: 'Flag for manual review',
	skip: 'Skip the duplicate row',
	update: 'Update the existing record',
};

import type {
	AssetStatus,
	AssetType,
	CriticalityLevel,
	ImportDuplicateStrategy,
	RequirableAssetField,
} from 'spernakit-shared';

import type { DataResponse } from './types';

import { apiClient } from './client';

/** Default dashboard/inventory filter preset. `null` means "no default filter". */
interface DefaultDashboardFilters {
	assetType: AssetType | null;
	criticality: CriticalityLevel | null;
	status: AssetStatus | null;
}

/** How staged imports reconcile rows that match an existing record. */
interface ImportBehavior {
	duplicateStrategy: ImportDuplicateStrategy;
	neverOverwriteNotes: boolean;
}

/** Administrator-managed settings for the infrastructure inventory domain. */
interface InfrastructureSettings {
	defaultDashboardFilters: DefaultDashboardFilters;
	importBehavior: ImportBehavior;
	requiredAssetFields: RequirableAssetField[];
	staleThresholdDays: number;
}

/** Partial patch accepted by the update endpoint. */
interface InfrastructureSettingsInput {
	defaultDashboardFilters?: Partial<DefaultDashboardFilters>;
	importBehavior?: Partial<ImportBehavior>;
	requiredAssetFields?: RequirableAssetField[];
	staleThresholdDays?: number;
}

async function getInfrastructureSettings(): Promise<InfrastructureSettings> {
	const res = await apiClient.get<DataResponse<InfrastructureSettings>>(
		'/settings/infrastructure'
	);
	return res.data;
}

async function updateInfrastructureSettings(
	input: InfrastructureSettingsInput
): Promise<InfrastructureSettings> {
	const res = await apiClient.put<DataResponse<InfrastructureSettings>>(
		'/settings/infrastructure',
		{ body: input }
	);
	return res.data;
}

export { getInfrastructureSettings, updateInfrastructureSettings };
export type {
	DefaultDashboardFilters,
	ImportBehavior,
	InfrastructureSettings,
	InfrastructureSettingsInput,
};

import type { AssetType, CriticalityLevel } from 'spernakit-shared';

import type { serviceCatalog, serviceDependencies } from '../../db/schema/services.ts';

type ServiceRow = typeof serviceCatalog.$inferSelect;
type ServiceDependencyRow = typeof serviceDependencies.$inferSelect;

/** Fields a client may set when creating a catalog service. */
interface CreateServiceInput {
	category?: null | string;
	criticality?: string;
	description?: null | string;
	expectedAvailability?: null | string;
	name: string;
	notes?: null | string;
	ownerId?: null | number;
	vendorId?: null | number;
}

/** Fields a client may change on an existing catalog service (all optional). */
type UpdateServiceInput = Partial<CreateServiceInput>;

interface ListServicesOptions {
	category?: string | undefined;
	criticality?: string | undefined;
	includeDeleted?: boolean | undefined;
	limit: number;
	ownerId?: number | undefined;
	page: number;
	search?: string | undefined;
	/**
	 * Workspace scope filter. When set, only services in this workspace are
	 * returned. Null/undefined leaves the query unscoped (single-inventory or
	 * SYSOP bypass).
	 */
	workspaceScope?: null | number | undefined;
}

/** Fields a client may set when adding a service dependency. */
interface CreateDependencyInput {
	dependencyType?: null | string;
	dependsOnAssetId?: null | number;
	dependsOnServiceId?: null | number;
	notes?: null | string;
}

/**
 * A catalog service with its owner/vendor resolved to display names and a count
 * of the assets that back it, so the list view can render ownership and coverage
 * without a second round-trip.
 */
type EnrichedServiceRow = ServiceRow & {
	backingAssetCount: number;
	ownerName: null | string;
	vendorName: null | string;
};

/** One asset that backs a service, resolved from the asset_services join. */
interface BackingAsset {
	assetId: number;
	assetType: AssetType | null;
	assignmentId: number;
	criticality: CriticalityLevel | null;
	isPrimary: boolean;
	name: null | string;
	role: null | string;
}

/** A service dependency edge with its target resolved to a display name. */
type ResolvedDependency = ServiceDependencyRow & {
	dependsOnAssetName: null | string;
	dependsOnAssetType: AssetType | null;
	dependsOnServiceName: null | string;
};

/** Detail payload for a single service: the record plus backing assets and dependencies. */
type ServiceDetail = EnrichedServiceRow & {
	backingAssets: BackingAsset[];
	dependencies: ResolvedDependency[];
};

/** Discriminated outcome so the route can map failures to HTTP status codes. */
type ServiceResult =
	| { error: 'conflict' | 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: ServiceRow };

/** Discriminated outcome for a dependency write. */
type DependencyResult =
	| { error: 'conflict' | 'not_found' | 'validation'; message: string; ok: false }
	| { ok: true; row: ServiceDependencyRow };

export type {
	BackingAsset,
	CreateDependencyInput,
	CreateServiceInput,
	DependencyResult,
	EnrichedServiceRow,
	ListServicesOptions,
	ResolvedDependency,
	ServiceDependencyRow,
	ServiceDetail,
	ServiceResult,
	ServiceRow,
	UpdateServiceInput,
};

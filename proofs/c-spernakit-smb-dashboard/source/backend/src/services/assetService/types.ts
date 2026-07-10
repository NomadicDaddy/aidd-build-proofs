import { type assets } from '../../db/schema/assets.ts';

type AssetRow = typeof assets.$inferSelect;

interface ChangeEventInput {
	action: string;
	actorId?: number;
	assetId: number;
	changes?: Record<string, unknown>;
	importId?: number;
	summary?: string;
}

/** Fields a client may set when creating or updating an asset. */
interface AssetWritableFields {
	assetTag?: null | string;
	assetType?: string;
	businessOwnerId?: null | number;
	criticality?: string;
	decommissionedAt?: null | string;
	description?: null | string;
	documentationUrl?: null | string;
	fqdn?: null | string;
	hostname?: null | string;
	isVirtual?: boolean;
	lastVerifiedAt?: null | string;
	managementUrl?: null | string;
	name?: string;
	networkZoneId?: null | number;
	notes?: null | string;
	operatingSystem?: null | string;
	osVersion?: null | string;
	parentHostId?: null | number;
	plannedReplacementAt?: null | string;
	platform?: null | string;
	primaryIp?: null | string;
	purchaseDate?: null | string;
	role?: null | string;
	serialNumber?: null | string;
	siteId?: null | number;
	status?: string;
	supportContact?: null | string;
	supportEndsAt?: null | string;
	technicalOwnerId?: null | number;
	vendorId?: null | number;
	warrantyExpiresAt?: null | string;
}

/** Lifecycle date fields accepted as ISO strings and stored as timestamps. */
const LIFECYCLE_DATE_KEYS = [
	'purchaseDate',
	'warrantyExpiresAt',
	'supportEndsAt',
	'plannedReplacementAt',
	'decommissionedAt',
	'lastVerifiedAt',
] as const;

interface CreateAssetInput extends AssetWritableFields {
	assetType: string;
	name: string;
}

type UpdateAssetInput = AssetWritableFields;

interface ListAssetsOptions {
	criticality?: string | undefined;
	exposureLevel?: string | undefined;
	includeDeleted?: boolean | undefined;
	ip?: string | undefined;
	limit: number;
	operatingSystem?: string | undefined;
	ownerId?: number | undefined;
	page: number;
	portNumber?: number | undefined;
	portReviewState?: string | undefined;
	portServiceId?: number | undefined;
	protocol?: string | undefined;
	role?: string | undefined;
	search?: string | undefined;
	siteId?: number | undefined;
	status?: string | undefined;
	type?: string | undefined;
	virtual?: boolean | undefined;
	/**
	 * Workspace scope filter. When set, only assets in this workspace are returned.
	 * Null/undefined leaves the query unscoped (single-inventory or SYSOP bypass).
	 */
	workspaceScope?: null | number | undefined;
}

export { LIFECYCLE_DATE_KEYS };
export type {
	AssetRow,
	AssetWritableFields,
	ChangeEventInput,
	CreateAssetInput,
	ListAssetsOptions,
	UpdateAssetInput,
};

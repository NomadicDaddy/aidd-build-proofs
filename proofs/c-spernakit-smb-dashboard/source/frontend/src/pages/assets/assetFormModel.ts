import type { AssetStatus, AssetType, CriticalityLevel } from 'spernakit-shared';

import type { Asset, CreateAssetInput } from '@/api/assets';

/** Local editable shape. Optional text fields default to empty strings. */
export interface AssetForm {
	assetType: AssetType;
	criticality: CriticalityLevel;
	description: string;
	fqdn: string;
	hostname: string;
	isVirtual: boolean;
	lastVerifiedAt: string;
	name: string;
	operatingSystem: string;
	plannedReplacementAt: string;
	primaryIp: string;
	purchaseDate: string;
	role: string;
	status: AssetStatus;
	supportEndsAt: string;
	warrantyExpiresAt: string;
}

export const EMPTY_FORM: AssetForm = {
	assetType: 'physical_server',
	criticality: 'unknown',
	description: '',
	fqdn: '',
	hostname: '',
	isVirtual: false,
	lastVerifiedAt: '',
	name: '',
	operatingSystem: '',
	plannedReplacementAt: '',
	primaryIp: '',
	purchaseDate: '',
	role: '',
	status: 'active',
	supportEndsAt: '',
	warrantyExpiresAt: '',
};

/** Convert an ISO timestamp to a `yyyy-mm-dd` value for a date input, or ''. */
function toDateInput(value: null | string): string {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 10);
}

export function assetToForm(asset: Asset): AssetForm {
	return {
		assetType: asset.assetType,
		criticality: asset.criticality,
		description: asset.description ?? '',
		fqdn: asset.fqdn ?? '',
		hostname: asset.hostname ?? '',
		isVirtual: asset.isVirtual,
		lastVerifiedAt: toDateInput(asset.lastVerifiedAt),
		name: asset.name,
		operatingSystem: asset.operatingSystem ?? '',
		plannedReplacementAt: toDateInput(asset.plannedReplacementAt),
		primaryIp: asset.primaryIp ?? '',
		purchaseDate: toDateInput(asset.purchaseDate),
		role: asset.role ?? '',
		status: asset.status,
		supportEndsAt: toDateInput(asset.supportEndsAt),
		warrantyExpiresAt: toDateInput(asset.warrantyExpiresAt),
	};
}

/** Convert a trimmed text field to `null` when empty (clears the column). */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** A `yyyy-mm-dd` date input → `null` when blank (clears the column). */
function orNullDate(value: string): null | string {
	return value.length > 0 ? value : null;
}

/** Build the create/update payload from the current form state. */
export function formToInput(form: AssetForm): CreateAssetInput {
	return {
		assetType: form.assetType,
		criticality: form.criticality,
		description: orNull(form.description),
		fqdn: orNull(form.fqdn),
		hostname: orNull(form.hostname),
		isVirtual: form.isVirtual,
		lastVerifiedAt: orNullDate(form.lastVerifiedAt),
		name: form.name.trim(),
		operatingSystem: orNull(form.operatingSystem),
		plannedReplacementAt: orNullDate(form.plannedReplacementAt),
		primaryIp: orNull(form.primaryIp),
		purchaseDate: orNullDate(form.purchaseDate),
		role: orNull(form.role),
		status: form.status,
		supportEndsAt: orNullDate(form.supportEndsAt),
		warrantyExpiresAt: orNullDate(form.warrantyExpiresAt),
	};
}

import type {
	AssetStatus,
	AssetType,
	CriticalityLevel,
	ImportDuplicateStrategy,
	RequirableAssetField,
} from 'spernakit-shared';

import {
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
	DEFAULT_STALE_THRESHOLD_DAYS,
	IMPORT_DUPLICATE_STRATEGIES,
	MAX_STALE_THRESHOLD_DAYS,
	MIN_STALE_THRESHOLD_DAYS,
	REQUIRABLE_ASSET_FIELDS,
} from 'spernakit-shared';

import { getByKeyRaw, seedDefault, update } from './settingsService.ts';

/** Single settings-store key holding the infrastructure domain settings JSON blob. */
const INFRA_SETTINGS_KEY = 'infra.domain';

/** Default dashboard/inventory filter preset applied when no URL filter is present. */
interface DefaultDashboardFilters {
	assetType: AssetType | null;
	criticality: CriticalityLevel | null;
	status: AssetStatus | null;
}

/** How staged imports treat rows that match an existing record. */
interface ImportBehavior {
	duplicateStrategy: ImportDuplicateStrategy;
	neverOverwriteNotes: boolean;
}

/**
 * Administrator-managed settings for the infrastructure inventory domain.
 * Persisted as a single JSON blob in the shared settings store and applied
 * across the dashboard (stale threshold), inventory (required fields on manual
 * entry, default filter preset), and import (behavior) flows.
 */
interface InfrastructureSettings {
	defaultDashboardFilters: DefaultDashboardFilters;
	importBehavior: ImportBehavior;
	requiredAssetFields: RequirableAssetField[];
	staleThresholdDays: number;
}

/** Partial patch accepted by {@link updateInfrastructureSettings}. */
interface InfrastructureSettingsPatch {
	defaultDashboardFilters?: Partial<DefaultDashboardFilters>;
	importBehavior?: Partial<ImportBehavior>;
	requiredAssetFields?: string[];
	staleThresholdDays?: number;
}

const DEFAULT_INFRASTRUCTURE_SETTINGS: InfrastructureSettings = {
	defaultDashboardFilters: { assetType: null, criticality: null, status: null },
	importBehavior: { duplicateStrategy: 'review', neverOverwriteNotes: true },
	requiredAssetFields: [],
	staleThresholdDays: DEFAULT_STALE_THRESHOLD_DAYS,
};

const REQUIRABLE_FIELD_SET = new Set<string>(REQUIRABLE_ASSET_FIELDS);
const ASSET_TYPE_SET = new Set<string>(ASSET_TYPES);
const ASSET_STATUS_SET = new Set<string>(ASSET_STATUSES);
const CRITICALITY_SET = new Set<string>(CRITICALITY_LEVELS);
const DUPLICATE_STRATEGY_SET = new Set<string>(IMPORT_DUPLICATE_STRATEGIES);

/** Simple TTL cache mirroring the auth-settings pattern. TTL: 60 seconds. */
let cachedSettings: InfrastructureSettings | null = null;
let settingsCacheExpiresAt = 0;

function coerceStaleThreshold(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_STALE_THRESHOLD_DAYS;
	const rounded = Math.round(parsed);
	return Math.min(MAX_STALE_THRESHOLD_DAYS, Math.max(MIN_STALE_THRESHOLD_DAYS, rounded));
}

// Keep only recognised, de-duplicated requirable field names, preserving canonical order.
function coerceRequiredFields(value: unknown): RequirableAssetField[] {
	if (!Array.isArray(value)) return [];
	const requested = new Set(
		value.filter((v): v is string => typeof v === 'string' && REQUIRABLE_FIELD_SET.has(v))
	);
	return REQUIRABLE_ASSET_FIELDS.filter((field) => requested.has(field));
}

function coerceEnum<T extends string>(value: unknown, allowed: Set<string>): null | T {
	return typeof value === 'string' && allowed.has(value) ? (value as T) : null;
}

function coerceDashboardFilters(value: unknown): DefaultDashboardFilters {
	const raw = (value ?? {}) as Record<string, unknown>;
	return {
		assetType: coerceEnum<AssetType>(raw.assetType, ASSET_TYPE_SET),
		criticality: coerceEnum<CriticalityLevel>(raw.criticality, CRITICALITY_SET),
		status: coerceEnum<AssetStatus>(raw.status, ASSET_STATUS_SET),
	};
}

function coerceImportBehavior(value: unknown): ImportBehavior {
	const raw = (value ?? {}) as Record<string, unknown>;
	const strategy = coerceEnum<ImportDuplicateStrategy>(
		raw.duplicateStrategy,
		DUPLICATE_STRATEGY_SET
	);
	return {
		duplicateStrategy:
			strategy ?? DEFAULT_INFRASTRUCTURE_SETTINGS.importBehavior.duplicateStrategy,
		neverOverwriteNotes:
			typeof raw.neverOverwriteNotes === 'boolean'
				? raw.neverOverwriteNotes
				: DEFAULT_INFRASTRUCTURE_SETTINGS.importBehavior.neverOverwriteNotes,
	};
}

// Normalise an arbitrary parsed blob into a complete, valid settings object.
function normalize(raw: Record<string, unknown>): InfrastructureSettings {
	return {
		defaultDashboardFilters: coerceDashboardFilters(raw.defaultDashboardFilters),
		importBehavior: coerceImportBehavior(raw.importBehavior),
		requiredAssetFields: coerceRequiredFields(raw.requiredAssetFields),
		staleThresholdDays: coerceStaleThreshold(raw.staleThresholdDays),
	};
}

function ensureSeeded(): void {
	seedDefault(
		INFRA_SETTINGS_KEY,
		DEFAULT_INFRASTRUCTURE_SETTINGS,
		'Infrastructure inventory domain settings'
	);
}

/**
 * Read the infrastructure domain settings, seeding defaults on first access and
 * always returning a fully-populated, validated object.
 *
 * @returns The current infrastructure settings
 */
function getInfrastructureSettings(): InfrastructureSettings {
	if (cachedSettings && Date.now() < settingsCacheExpiresAt) {
		return cachedSettings;
	}

	ensureSeeded();

	const setting = getByKeyRaw(INFRA_SETTINGS_KEY);
	let parsed: Record<string, unknown> = {};
	if (setting?.value) {
		try {
			const candidate: unknown = JSON.parse(setting.value);
			if (candidate && typeof candidate === 'object') {
				parsed = candidate as Record<string, unknown>;
			}
		} catch {
			parsed = {};
		}
	}

	const result = normalize(parsed);
	cachedSettings = result;
	settingsCacheExpiresAt = Date.now() + 60_000;
	return result;
}

/**
 * Merge a partial patch onto the current settings, persist, and return the new
 * effective settings. Nested objects are merged field-by-field so a caller can
 * update, say, a single dashboard filter without clearing the others.
 *
 * @param patch - Partial settings to apply
 * @param updatedBy - Id of the acting user
 * @returns The updated, normalised settings
 */
function updateInfrastructureSettings(
	patch: InfrastructureSettingsPatch,
	updatedBy: number
): InfrastructureSettings {
	const current = getInfrastructureSettings();
	const merged: InfrastructureSettings = normalize({
		defaultDashboardFilters: {
			...current.defaultDashboardFilters,
			...(patch.defaultDashboardFilters ?? {}),
		},
		importBehavior: { ...current.importBehavior, ...(patch.importBehavior ?? {}) },
		requiredAssetFields: patch.requiredAssetFields ?? current.requiredAssetFields,
		staleThresholdDays: patch.staleThresholdDays ?? current.staleThresholdDays,
	});

	update({
		description: 'Infrastructure inventory domain settings',
		key: INFRA_SETTINGS_KEY,
		updatedBy,
		value: JSON.stringify(merged),
	});

	cachedSettings = null;
	settingsCacheExpiresAt = 0;
	return merged;
}

/**
 * Given an asset-creation payload, return the configured required fields that
 * are absent. A field is considered missing when it is null/undefined or, for
 * string values, blank after trimming.
 *
 * @param input - The asset create payload (a record of field → value)
 * @returns The list of configured required fields that are missing
 */
function missingRequiredAssetFields(input: Record<string, unknown>): RequirableAssetField[] {
	const { requiredAssetFields } = getInfrastructureSettings();
	return requiredAssetFields.filter((field) => {
		const value = input[field];
		if (value === undefined || value === null) return true;
		if (typeof value === 'string' && value.trim() === '') return true;
		return false;
	});
}

export {
	DEFAULT_INFRASTRUCTURE_SETTINGS,
	getInfrastructureSettings,
	missingRequiredAssetFields,
	updateInfrastructureSettings,
};
export type { InfrastructureSettings, InfrastructureSettingsPatch };

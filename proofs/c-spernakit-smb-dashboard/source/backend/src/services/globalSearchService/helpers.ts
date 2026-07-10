import type { assets } from '../../db/schema/assets.ts';

/** Upper bound on rows scanned per underlying source query, before aggregation. */
const PER_SOURCE_SCAN_LIMIT = 200;

/** Default and maximum number of results returned per group (assets, services). */
const DEFAULT_GROUP_LIMIT = 20;
const MAX_GROUP_LIMIT = 50;

/**
 * Clamp a requested per-group limit into the allowed range.
 *
 * @param limit - The requested per-group limit, or undefined for the default
 * @returns The limit clamped to [1, MAX_GROUP_LIMIT]
 */
function clampLimit(limit: number | undefined): number {
	if (limit === undefined || Number.isNaN(limit)) return DEFAULT_GROUP_LIMIT;
	return Math.max(1, Math.min(MAX_GROUP_LIMIT, Math.trunc(limit)));
}

/**
 * Case-insensitive substring test that tolerates non-string / null values.
 *
 * @param value - The value to test (only strings can match)
 * @param termLower - The already-lowercased search term
 * @returns True when value is a string containing termLower
 */
function contains(value: unknown, termLower: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(termLower);
}

/**
 * Register a matched field label for an asset id, creating the set on first hit.
 *
 * @param matches - The accumulator mapping asset id to matched-field labels
 * @param id - Asset id
 * @param field - Human-readable label for the field that matched
 */
function addMatch(matches: Map<number, Set<string>>, id: number, field: string): void {
	const existing = matches.get(id);
	if (existing) {
		existing.add(field);
	} else {
		matches.set(id, new Set([field]));
	}
}

/** Direct asset columns searched for every role, paired with a display label. */
const PUBLIC_ASSET_FIELDS: [keyof typeof assets.$inferSelect, string][] = [
	['name', 'name'],
	['hostname', 'hostname'],
	['fqdn', 'FQDN'],
	['primaryIp', 'IP'],
	['serialNumber', 'serial'],
	['assetTag', 'asset tag'],
	['role', 'role'],
	['operatingSystem', 'OS'],
	['osVersion', 'OS version'],
	['platform', 'platform'],
	['description', 'description'],
];

/**
 * Sensitive asset columns searched only for OPERATOR+ callers, mirroring the
 * fields redacted by {@link canViewSensitiveAssetFields}. Low-privilege viewers
 * must not be able to locate an asset by content they are not allowed to see.
 */
const SENSITIVE_ASSET_FIELDS: [keyof typeof assets.$inferSelect, string][] = [
	['notes', 'notes'],
	['managementUrl', 'management URL'],
	['supportContact', 'support contact'],
];

export {
	addMatch,
	clampLimit,
	contains,
	DEFAULT_GROUP_LIMIT,
	MAX_GROUP_LIMIT,
	PER_SOURCE_SCAN_LIMIT,
	PUBLIC_ASSET_FIELDS,
	SENSITIVE_ASSET_FIELDS,
};

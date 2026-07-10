import type { UserRole } from '../types/roles.ts';

import { ROLE_HIERARCHY } from '../types/roles.ts';

/**
 * Asset fields that carry sensitive operational data (internal operator notes,
 * privileged management endpoints, and support/escalation contacts). The spec's
 * Security & Privacy requirements mandate hiding these from low-privilege
 * viewers who have read access to the inventory but should not see the
 * operational detail behind it.
 */
const SENSITIVE_ASSET_FIELDS = ['managementUrl', 'notes', 'supportContact'] as const;

/**
 * Minimum role required to see {@link SENSITIVE_ASSET_FIELDS}. VIEWER (read-only
 * help-desk / auditor access) sees the redacted record; OPERATOR and above see
 * the full record.
 */
const MIN_ROLE_FOR_SENSITIVE_FIELDS: UserRole = 'OPERATOR';

/**
 * Whether a role is allowed to see the sensitive asset fields.
 *
 * @param role - The requester's effective role, or null if unresolved
 * @returns True when the role meets or exceeds {@link MIN_ROLE_FOR_SENSITIVE_FIELDS}
 */
function canViewSensitiveAssetFields(role: null | UserRole): boolean {
	if (!role) return false;
	return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[MIN_ROLE_FOR_SENSITIVE_FIELDS];
}

/**
 * Return a copy of an asset with sensitive fields nulled out when the requester
 * is not permitted to see them. Authorized roles get the record unchanged.
 *
 * @param asset - The asset row to redact
 * @param role - The requester's effective role
 * @returns The asset, redacted in place of a copy when the role is low-privilege
 */
function redactAssetForRole<T extends Record<string, unknown>>(asset: T, role: null | UserRole): T {
	if (canViewSensitiveAssetFields(role)) {
		return asset;
	}
	const redacted = { ...asset };
	for (const field of SENSITIVE_ASSET_FIELDS) {
		if (field in redacted) {
			(redacted as Record<string, unknown>)[field] = null;
		}
	}
	return redacted;
}

export {
	canViewSensitiveAssetFields,
	MIN_ROLE_FOR_SENSITIVE_FIELDS,
	redactAssetForRole,
	SENSITIVE_ASSET_FIELDS,
};

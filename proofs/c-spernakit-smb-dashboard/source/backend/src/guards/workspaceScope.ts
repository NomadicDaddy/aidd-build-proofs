import type { AuthPayload } from '../plugins/auth.ts';
import type { ErrorResponse } from '../utils/errorResponse.ts';

import { getAppFeatures } from '../routes/settings/app-features.ts';
import { isSysop } from './role.ts';
import { requireSelectedWorkspaceAccess } from './workspaceAccess.ts';

interface WorkspaceScopeContext {
	set: { status?: number | string };
	user: AuthPayload | null;
	workspaceId: null | number;
}

/**
 * Whether workspace scoping is switched on for this deployment. Driven by the
 * `app.workspaces_enabled` app-feature flag (fail-closed). When disabled the
 * inventory is a single shared boundary and no workspace filtering is applied,
 * preserving the pre-workspace behaviour.
 */
function workspaceScopingEnabled(): boolean {
	return getAppFeatures().workspacesEnabled;
}

/**
 * Resolve the workspace id a domain (asset/relationship/service) query must be
 * scoped to, or null for an unrestricted (cross-workspace) query.
 *
 * Returns null — meaning "do not filter by workspace" — when:
 * - workspace scoping is disabled (single shared inventory), or
 * - the caller is a SYSOP reading without an explicit X-Workspace-ID header
 *   (the cross-workspace bypass).
 *
 * Otherwise the active workspace from the header is returned. The companion
 * {@link requireDomainWorkspaceAccess} guard has already verified the caller's
 * membership of that workspace, so a non-SYSOP can only ever resolve to a
 * workspace they belong to.
 *
 * @param user - The authenticated user payload (may be null)
 * @param workspaceId - The active workspace from the X-Workspace-ID header
 * @returns The workspace id to filter by, or null for no workspace filter
 */
function resolveWorkspaceScope(
	user: AuthPayload | null,
	workspaceId: null | number
): null | number {
	if (!workspaceScopingEnabled()) return null;
	if (isSysop(user) && workspaceId === null) return null;
	return workspaceId;
}

/**
 * Guard for domain (asset/relationship/service) routes. A no-op when workspace
 * scoping is disabled, so single-inventory deployments are unaffected. When
 * enabled it enforces the workspace boundary: SYSOPs may operate cross-workspace
 * (no header required), while every other caller must supply an X-Workspace-ID
 * header naming a workspace they belong to. Compose it after the role guard, e.g.
 * `beforeHandle: (ctx) => requireRoleFresh('VIEWER')(ctx) ?? requireDomainWorkspaceAccess(ctx)`.
 *
 * @param ctx - Guard context carrying set, user, and the derived workspaceId
 * @returns An error response when access is denied, or undefined when allowed
 */
function requireDomainWorkspaceAccess(ctx: WorkspaceScopeContext): ErrorResponse | undefined {
	if (!workspaceScopingEnabled()) return undefined;
	return requireSelectedWorkspaceAccess(ctx);
}

export { requireDomainWorkspaceAccess, resolveWorkspaceScope, workspaceScopingEnabled };
export type { WorkspaceScopeContext };

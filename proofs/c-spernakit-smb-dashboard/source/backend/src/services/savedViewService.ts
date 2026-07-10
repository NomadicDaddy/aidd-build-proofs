import { and, eq } from 'drizzle-orm';
import { MAX_SAVED_VIEWS_PER_USER, SAVED_VIEW_FILTER_KEYS } from 'spernakit-shared';

import { getDb } from '../db/index.ts';
import { savedViews } from '../db/schema/savedViews.ts';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A persisted saved inventory view as returned to API callers. */
interface SavedView {
	createdAt: Date;
	filters: Record<string, string>;
	id: number;
	name: string;
	updatedAt: Date;
	userId: number;
	workspaceId: null | number;
}

interface SavedViewInput {
	filters: Record<string, string>;
	name: string;
	workspaceId?: null | number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const ALLOWED_FILTER_KEYS = new Set<string>(SAVED_VIEW_FILTER_KEYS);

/**
 * Normalise an untrusted filter map: keep only recognised inventory filter keys
 * with non-empty string values. This prevents junk or oversized payloads from
 * being persisted and guarantees a loaded view only sets known URL parameters.
 *
 * @param filters - Raw filter map from the request body.
 * @returns A filter map containing only allowed keys with trimmed values.
 */
function sanitizeFilters(filters: Record<string, string>): Record<string, string> {
	const clean: Record<string, string> = {};
	for (const [key, value] of Object.entries(filters)) {
		if (!ALLOWED_FILTER_KEYS.has(key)) continue;
		if (typeof value !== 'string') continue;
		const trimmed = value.trim();
		if (trimmed.length === 0 || trimmed.length > 200) continue;
		clean[key] = trimmed;
	}
	return clean;
}

/**
 * Find a saved view owned by the user, respecting the active workspace scope.
 *
 * @param id - Saved view id.
 * @param userId - Owning user id.
 * @param workspaceId - Active workspace scope, or null for cross-workspace (SYSOP).
 * @returns The raw row, or undefined when not found / soft-deleted.
 */
function findOwnedView(
	id: number,
	userId: number,
	workspaceId: null | number
): SavedView | undefined {
	const db = getDb();
	const conditions = [
		eq(savedViews.id, id),
		eq(savedViews.userId, userId),
		eq(savedViews.isDeleted, false),
	];
	if (workspaceId !== null) {
		conditions.push(eq(savedViews.workspaceId, workspaceId));
	}
	return db
		.select()
		.from(savedViews)
		.where(and(...conditions))
		.get() as SavedView | undefined;
}

/* -------------------------------------------------------------------------- */
/*  CRUD operations                                                           */
/* -------------------------------------------------------------------------- */

/**
 * List all saved views belonging to a user, optionally scoped to a workspace.
 *
 * When workspaceId is a number, only views in that workspace are returned.
 * When null (SYSOP cross-workspace view), all workspaces for the user are returned.
 *
 * @param userId - Owning user id.
 * @param workspaceId - Active workspace scope, or null for cross-workspace.
 * @returns The user's saved views (bounded by the per-user cap).
 */
function listSavedViews(userId: number, workspaceId: null | number = null): SavedView[] {
	const db = getDb();
	const conditions = [eq(savedViews.userId, userId), eq(savedViews.isDeleted, false)];
	if (workspaceId !== null) {
		conditions.push(eq(savedViews.workspaceId, workspaceId));
	}
	// Bound the result set with the same per-user cap enforced by createSavedView so
	// the "all database operations must be bounded" invariant holds even if rows
	// accumulate past the cap.
	return db
		.select()
		.from(savedViews)
		.where(and(...conditions))
		.limit(MAX_SAVED_VIEWS_PER_USER)
		.all() as SavedView[];
}

/**
 * Create a new saved view for a user, scoped to a workspace.
 *
 * @param userId - Owning user id.
 * @param input - Name, filters, and active workspace id.
 * @returns The newly created saved view.
 * @throws Error when the per-user limit is reached.
 */
function createSavedView(userId: number, input: SavedViewInput): SavedView {
	const db = getDb();

	const existingConditions = [eq(savedViews.userId, userId), eq(savedViews.isDeleted, false)];
	if (input.workspaceId !== undefined && input.workspaceId !== null) {
		existingConditions.push(eq(savedViews.workspaceId, input.workspaceId));
	}
	const existing = db
		.select({ id: savedViews.id })
		.from(savedViews)
		.where(and(...existingConditions))
		.all();

	if (existing.length >= MAX_SAVED_VIEWS_PER_USER) {
		throw new Error(`Saved view limit reached (max ${MAX_SAVED_VIEWS_PER_USER})`);
	}

	return db
		.insert(savedViews)
		.values({
			createdBy: userId,
			filters: sanitizeFilters(input.filters),
			name: input.name,
			userId,
			workspaceId: input.workspaceId ?? null,
		})
		.returning()
		.get() as SavedView;
}

/**
 * Update a saved view's name and/or filters, scoped by active workspace.
 *
 * @param id - Saved view id.
 * @param userId - Owning user id.
 * @param input - New name and filters.
 * @param workspaceId - Active workspace scope, or null for cross-workspace.
 * @returns The updated view, or null if not found.
 */
function updateSavedView(
	id: number,
	userId: number,
	input: SavedViewInput,
	workspaceId: null | number = null
): null | SavedView {
	const db = getDb();

	if (!findOwnedView(id, userId, workspaceId)) return null;

	db.update(savedViews)
		.set({
			filters: sanitizeFilters(input.filters),
			name: input.name,
			updatedAt: new Date(),
			updatedBy: userId,
		})
		.where(eq(savedViews.id, id))
		.run();

	return findOwnedView(id, userId, workspaceId) ?? null;
}

/**
 * Soft-delete a saved view, scoped by active workspace.
 *
 * @param id - Saved view id.
 * @param userId - Owning user id.
 * @param workspaceId - Active workspace scope, or null for cross-workspace.
 * @returns True if deleted, false if not found.
 */
function deleteSavedView(id: number, userId: number, workspaceId: null | number = null): boolean {
	const db = getDb();

	if (!findOwnedView(id, userId, workspaceId)) return false;

	const now = new Date();
	db.update(savedViews)
		.set({ deletedAt: now, deletedBy: userId, isDeleted: true, updatedAt: now })
		.where(eq(savedViews.id, id))
		.run();

	return true;
}

export { createSavedView, deleteSavedView, listSavedViews, sanitizeFilters, updateSavedView };
export type { SavedView, SavedViewInput };

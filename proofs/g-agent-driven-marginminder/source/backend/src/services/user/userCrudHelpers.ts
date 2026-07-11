import { and, eq } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';

import { getDb } from '../../db/index.ts';
import { users } from '../../db/schema/users.ts';
import { type UserRole } from '../../types/roles.ts';

type UserPublic = {
	createdAt: Date;
	email: string;
	failedLoginAttempts: number;
	id: number;
	lastLoginAt: Date | null;
	lockedUntil: Date | null;
	role: UserRole;
	updatedAt: Date | null;
	username: string;
};

/** LRU cache for user profile lookups by ID. TTL: 5 minutes, max 500 entries. */
const userCache = new LRUCache<number, UserPublic>({
	max: 500,
	ttl: 5 * 60 * 1000,
});

/**
 * Invalidate a cached user profile by ID. Used by sibling services (e.g.
 * userPasswordAdminService) that mutate the user row but do not own the cache.
 *
 * @param id - User ID whose cached profile should be evicted
 */
function invalidateUserProfileCache(id: number): void {
	userCache.delete(id);
}

/**
 * Get the shared user cache instance. Only for use by userCrud.ts — other
 * consumers should import from the facade (userService.ts).
 *
 * @returns The LRU cache instance for user profiles
 */
function getUserCache(): LRUCache<number, UserPublic> {
	return userCache;
}

/**
 * Unlock a locked user account by resetting failed login attempts and clearing the lock.
 *
 * @param id - User ID to unlock
 * @returns True if the user was found and unlocked, false if not found
 */
function unlockUser(id: number): boolean {
	const db = getDb();
	const existing = db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, id), eq(users.isDeleted, false)))
		.get();

	if (!existing) return false;

	db.update(users)
		.set({
			failedLoginAttempts: 0,
			lockedUntil: null,
			updatedAt: new Date(),
		})
		.where(eq(users.id, id))
		.run();

	userCache.delete(id);
	return true;
}

/**
 * Hard-delete a user for rollback compensation during registration.
 * This is intentionally NOT a soft delete — the user was only partially
 * initialized and should not appear in audit or recovery paths.
 *
 * @param userId - User ID to permanently delete
 */
function hardDeleteUserForRollback(userId: number): void {
	const db = getDb();
	db.delete(users).where(eq(users.id, userId)).run();
	userCache.delete(userId);
}

export { getUserCache, hardDeleteUserForRollback, invalidateUserProfileCache, unlockUser };
export type { UserPublic };

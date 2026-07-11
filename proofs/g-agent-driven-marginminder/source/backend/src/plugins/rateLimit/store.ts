import type { RateLimitCheckResult } from '../../services/rateLimitService.ts';

import { msToRetryAfterSeconds } from '../../constants/auth.ts';
import { RATE_LIMIT_CLEANUP_INTERVAL_MS } from '../../constants/rateLimit.ts';

const MAX_IN_MEMORY_ENTRIES = 10_000;

/**
 * In-memory fallback for route-specific rate limits.
 * Route handlers must call checkRouteLimit(...) so config.rateLimit.backend
 * dispatches uniformly to memory or database storage.
 */
interface InMemoryEntry {
	count: number;
	resetAt: number;
}

interface RateLimitStore {
	check: (key: string, maxRequests: number, windowMs: number) => RateLimitCheckResult;
	reset: (key: string) => void;
	startCleanup: (onCleanup?: () => void) => void;
	stopCleanup: () => void;
}

function createRateLimitStore(): RateLimitStore {
	const entries = new Map<string, InMemoryEntry>();
	let interval: null | ReturnType<typeof setInterval> = null;

	function evictOldest(): void {
		if (entries.size <= MAX_IN_MEMORY_ENTRIES) return;
		// Evict oldest entries (first inserted, Map preserves insertion order)
		const excess = entries.size - MAX_IN_MEMORY_ENTRIES;
		let removed = 0;
		for (const key of entries.keys()) {
			if (removed >= excess) break;
			entries.delete(key);
			removed++;
		}
	}

	return {
		check(key: string, maxRequests: number, windowMs: number): RateLimitCheckResult {
			const now = Date.now();
			const existing = entries.get(key);

			if (!existing || existing.resetAt <= now) {
				const resetAtMs = now + windowMs;
				entries.set(key, { count: 1, resetAt: resetAtMs });
				evictOldest();
				return { count: 1, limited: false, resetAt: new Date(resetAtMs) };
			}

			existing.count++;
			if (existing.count > maxRequests) {
				return {
					count: existing.count,
					limited: true,
					resetAt: new Date(existing.resetAt),
					retryAfter: msToRetryAfterSeconds(existing.resetAt, now),
				};
			}

			return { count: existing.count, limited: false, resetAt: new Date(existing.resetAt) };
		},

		reset(key: string): void {
			entries.delete(key);
		},

		startCleanup(onCleanup?: () => void): void {
			if (interval) return;
			interval = setInterval(() => {
				const now = Date.now();
				for (const [key, entry] of entries) {
					if (entry.resetAt <= now) entries.delete(key);
				}
				onCleanup?.();
			}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
			interval.unref();
		},

		stopCleanup(): void {
			if (interval) {
				clearInterval(interval);
				interval = null;
			}
			entries.clear();
		},
	};
}

export { createRateLimitStore };
export type { RateLimitStore };

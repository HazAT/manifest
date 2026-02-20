/** Configuration for rate limiting a feature. */
export interface RateLimitConfig {
	/** Maximum number of requests allowed within the window. */
	max: number;
	/** Duration of the sliding window in seconds. */
	windowSeconds: number;
}

/** Result of a rate limit check. */
export interface RateLimitResult {
	/** Whether the request is allowed. */
	allowed: boolean;
	/** Number of requests remaining in the current window. */
	remaining: number;
	/** Seconds until the next request will be allowed (only set when blocked). */
	retryAfter?: number;
}

/** In-memory store: key → array of request timestamps (ms). */
const store = new Map<string, number[]>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Check whether a request identified by `key` is allowed under the given rate limit config.
 * Uses a sliding window algorithm: only timestamps within the last `windowSeconds` are counted.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
	const now = Date.now();
	const windowMs = config.windowSeconds * 1000;
	const cutoff = now - windowMs;

	let timestamps = store.get(key);
	if (timestamps) {
		timestamps = timestamps.filter((t) => t > cutoff);
	} else {
		timestamps = [];
	}

	if (timestamps.length >= config.max) {
		store.set(key, timestamps);
		const oldestInWindow = timestamps[0]!;
		const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
		return { allowed: false, remaining: 0, retryAfter };
	}

	timestamps.push(now);
	store.set(key, timestamps);
	return { allowed: true, remaining: config.max - timestamps.length };
}

/**
 * Start a periodic cleanup that sweeps stale keys every 60 seconds.
 * Call this once at server startup.
 */
export function startCleanup(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		for (const [key, timestamps] of store) {
			if (timestamps.length === 0) {
				store.delete(key);
			}
		}
	}, 60_000);
	// Don't keep the process alive just for cleanup
	if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
		cleanupTimer.unref();
	}
}

/** Stop the periodic cleanup interval. */
export function stopCleanup(): void {
	if (cleanupTimer) {
		clearInterval(cleanupTimer);
		cleanupTimer = null;
	}
}

/** Clear all stored state. Useful for testing. */
export function reset(): void {
	store.clear();
}

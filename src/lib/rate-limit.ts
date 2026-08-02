import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Lazy Redis singleton ─────────────────────────────────────────────────────
// Defer client creation until first use so that the module doesn't crash
// at import time when Upstash env vars are not yet configured.

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_")) {
    // Credentials not configured yet — return null so callers can fail-open.
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Lazy rate-limiter singletons ─────────────────────────────────────────────

let _authRateLimit: Ratelimit | null = null;
let _globalApiRateLimit: Ratelimit | null = null;

/**
 * Strict rate limiter for Authentication API routes.
 * Limits to 5 requests per 1 minute.
 * Returns null if Redis is not configured.
 */
export function getAuthRateLimit(): Ratelimit | null {
  if (_authRateLimit) return _authRateLimit;
  const redis = getRedis();
  if (!redis) return null;
  _authRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/auth",
  });
  return _authRateLimit;
}

/**
 * Standard global rate limiter for general API routes.
 * Limits to 100 requests per 10 seconds.
 * Returns null if Redis is not configured.
 */
export function getGlobalApiRateLimit(): Ratelimit | null {
  if (_globalApiRateLimit) return _globalApiRateLimit;
  const redis = getRedis();
  if (!redis) return null;
  _globalApiRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "10 s"),
    analytics: true,
    prefix: "@upstash/ratelimit/api",
  });
  return _globalApiRateLimit;
}

import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import type { LimiterKind } from "@/lib/rate-limit-paths";

/*
 * Upstash sliding-window limiters, created on first use.
 *
 *  auth    5 requests / 1 minute / IP     sign-in, sign-up, OTP verification, password reset
 *  form    5 requests / 10 minutes / IP   contact form and newsletter (each route counted separately)
 *  general 100 requests / 10 seconds / IP everything else under /api
 *
 * Without Redis: returns null in development (limits off, one-time warning from lib/redis.ts),
 * throws in production (the proxy then fails closed for auth/form routes, see src/proxy.ts).
 * Note: @upstash/ratelimit lets a request through when Redis does not answer within its
 * `timeout` (5 s by default); that is the library's own availability trade-off.
 */

const limiters: Partial<Record<LimiterKind, Ratelimit>> = {};

export function getRateLimiter(kind: LimiterKind): Ratelimit | null {
  const existing = limiters[kind];
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const limiter =
    kind === "auth"
      ? Ratelimit.slidingWindow(5, "1 m")
      : kind === "form"
        ? Ratelimit.slidingWindow(5, "10 m")
        : Ratelimit.slidingWindow(100, "10 s");

  return (limiters[kind] = new Ratelimit({
    redis,
    limiter,
    analytics: true,
    prefix: `@upstash/ratelimit/${kind}`,
  }));
}

/** Test helper */
export function resetRateLimitersForTests() {
  for (const kind of Object.keys(limiters) as LimiterKind[]) delete limiters[kind];
}

import { Redis } from "@upstash/redis";
import { getRedisConfig, isProduction, requireRedisConfig } from "@/lib/env";

/*
 * One place that creates the Upstash client.
 *
 * What happens when Redis is not configured (documented in docs/env.md):
 *  - Development / test: getRedis() returns null. Rate limits and sign-in lockout switch off,
 *    with a one-time console warning. OTP codes need Redis, so those routes use requireRedis().
 *  - Production: getRedis() throws an error that names the missing variable. Security checks
 *    (rate limits, sign-in lockout, OTP codes) therefore fail closed instead of silently
 *    switching off.
 */

let client: Redis | null = null;
let warned = false;

function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.warn(`[redis] ${message}`);
}

/** The Redis client, or null in development when Redis is not configured. Throws in production. */
export function getRedis(): Redis | null {
  if (client) return client;
  const config = getRedisConfig();
  if (!config) {
    if (isProduction()) requireRedisConfig(); // throws, naming the missing variable
    warnOnce(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. Rate limiting and sign-in lockout are OFF (development only; production refuses to run without them).",
    );
    return null;
  }
  client = new Redis(config);
  return client;
}

/** The Redis client; throws (naming the variable) when Redis is not configured, in any environment. */
export function requireRedis(): Redis {
  if (client) return client;
  client = new Redis(requireRedisConfig());
  return client;
}

/** Test helper: forget the client and the one-time warning. */
export function resetRedisForTests() {
  client = null;
  warned = false;
}

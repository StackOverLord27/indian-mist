import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_")) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const k = (key: string) => `attempts:${key}`;

/** True when this key has already failed `max` times inside its window. Fails open without Redis. */
export async function isBlocked(key: string, max: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const count = await redis.get<number>(k(key));
  return Number(count ?? 0) >= max;
}

/** Counts one failed attempt. The window starts at the first failure. */
export async function recordFailure(key: string, windowSec: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const count = await redis.incr(k(key));
  if (count === 1) await redis.expire(k(key), windowSec);
  return count;
}

export async function clearAttempts(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(k(key));
}

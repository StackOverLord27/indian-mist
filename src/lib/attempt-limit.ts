import { getRedis, requireRedis } from "@/lib/redis";

/*
 * Counters in Redis for sign-in lockout, promo-code guessing and OTP e-mails.
 * Without Redis configured these switch off in development (one-time warning from lib/redis.ts)
 * and throw in production, so a misconfigured production site fails closed.
 */

const k = (key: string) => `attempts:${key}`;

/**
 * Adds one to a counter and makes sure it has a time limit, in a single atomic step.
 * (A separate INCR then EXPIRE could leave a counter without an expiry if the function died
 * between the two calls, which would block that key forever.)
 */
async function incrementWithWindow(redis: NonNullable<ReturnType<typeof getRedis>>, key: string, windowSec: number) {
  const [count] = await redis.multi().incr(key).expire(key, windowSec, "NX").exec<[number, number]>();
  return count;
}

/** True when this key has already failed `max` times inside its window. */
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
  return incrementWithWindow(redis, k(key), windowSec);
}

export async function clearAttempts(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(k(key));
}

// ─── One address must not be able to receive a stream of OTP e-mails ─────────

export const OTP_EMAILS_PER_ADDRESS = 5;
export const OTP_EMAIL_WINDOW_SEC = 60 * 60;

/**
 * Call before sending an OTP e-mail. Returns false once this address has been sent (or asked
 * for) OTP_EMAILS_PER_ADDRESS codes of this kind within the last hour. It counts every request,
 * whether or not the address belongs to an account, so the answer never reveals which do.
 * Always needs Redis (OTP codes cannot work without it).
 */
export async function allowOtpEmail(purpose: "signup" | "reset", email: string): Promise<boolean> {
  const count = await incrementWithWindow(requireRedis(), `otp_send:${purpose}:${email}`, OTP_EMAIL_WINDOW_SEC);
  return count <= OTP_EMAILS_PER_ADDRESS;
}

// ─── Starting a checkout holds stock for 15 minutes ──────────────────────────

export const CHECKOUT_STARTS_PER_ACCOUNT = 10;
export const CHECKOUT_STARTS_PER_IP = 30; // higher: shared networks (offices, mobile carriers) are many shoppers
export const CHECKOUT_START_WINDOW_SEC = 60 * 60;

/**
 * Call before holding stock for a checkout. Returns false once this account (or this address)
 * has started its allowance of checkouts within the last hour. Money path: always needs Redis and
 * throws when it cannot answer (the checkout then fails instead of running unlimited).
 */
export async function allowCheckoutStart(userId: string, ip: string): Promise<boolean> {
  const redis = requireRedis();
  const account = await incrementWithWindow(redis, `checkout_start:user:${userId}`, CHECKOUT_START_WINDOW_SEC);
  const address = await incrementWithWindow(redis, `checkout_start:ip:${ip}`, CHECKOUT_START_WINDOW_SEC);
  return account <= CHECKOUT_STARTS_PER_ACCOUNT && address <= CHECKOUT_STARTS_PER_IP;
}

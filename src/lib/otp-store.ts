import { Redis } from '@upstash/redis'
import { timingSafeEqual } from 'crypto'

// ─── Lazy Redis singleton ─────────────────────────────────────────────────────
// Defer client creation until first use so that the module doesn't crash
// at import time when Upstash env vars are placeholder values.

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_")) {
    throw new Error(
      "Upstash Redis is not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env"
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export interface OtpData {
  otp: string;
  name?: string;
  password?: string;
}

// Signup and password-reset codes live in separate namespaces so one can never be used for the other.
export type OtpPurpose = "signup" | "reset";

// 5 minutes in seconds
const OTP_TTL_SECONDS = 5 * 60;
// A 6-digit code must not be guessable by trying many values
const MAX_OTP_ATTEMPTS = 5;

const otpKey = (purpose: OtpPurpose, email: string) => `otp:${purpose}:${email}`;
const attemptsKey = (purpose: OtpPurpose, email: string) => `otp_attempts:${purpose}:${email}`;

/**
 * Stores the OTP and pending user data in Redis with a 5-minute expiration.
 */
export async function setOtp(
  purpose: OtpPurpose,
  email: string,
  otp: string,
  name?: string,
  password?: string,
) {
  const data: OtpData = { otp, name, password };
  const redis = getRedis();
  // Upstash auto-serializes objects — do NOT JSON.stringify manually.
  await redis.set(otpKey(purpose, email), data, { ex: OTP_TTL_SECONDS });
  await redis.del(attemptsKey(purpose, email));
}

/**
 * Verifies the provided OTP. After too many wrong guesses the code is destroyed,
 * so it cannot be brute-forced.
 */
export async function verifyOtp(
  purpose: OtpPurpose,
  email: string,
  providedOtp: string,
): Promise<OtpData | null> {
  const redis = getRedis();
  const data = await redis.get<OtpData>(otpKey(purpose, email));

  if (!data) return null;

  const attempts = await redis.incr(attemptsKey(purpose, email));
  if (attempts === 1) await redis.expire(attemptsKey(purpose, email), OTP_TTL_SECONDS);
  if (attempts > MAX_OTP_ATTEMPTS) {
    await redis.del(otpKey(purpose, email), attemptsKey(purpose, email));
    return null;
  }

  const expected = Buffer.from(String(data.otp));
  const given = Buffer.from(String(providedOtp));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  return data;
}

/**
 * Deletes the OTP data (and its attempt counter) from Redis.
 */
export async function deleteOtp(purpose: OtpPurpose, email: string) {
  await getRedis().del(otpKey(purpose, email), attemptsKey(purpose, email));
}

/**
 * Checks if an OTP already exists for the given email.
 * Useful for preventing rapid overlapping requests.
 */
export async function checkOtpExists(purpose: OtpPurpose, email: string): Promise<boolean> {
  const data = await getRedis().get<OtpData>(otpKey(purpose, email));
  return !!data;
}

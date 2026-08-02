import { Redis } from '@upstash/redis'

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

// 5 minutes in seconds
const OTP_TTL_SECONDS = 5 * 60;

/**
 * Stores the OTP and pending user data in Redis with a 5-minute expiration.
 */
export async function setOtp(email: string, otp: string, name?: string, password?: string) {
  const data: OtpData = { otp, name, password };
  
  // Upstash auto-serializes objects — do NOT JSON.stringify manually.
  // { ex: 300 } sets the key to expire automatically after 300 seconds.
  await getRedis().set(email, data, { ex: OTP_TTL_SECONDS });
}

/**
 * Verifies the provided OTP against the one stored in Redis.
 * If valid, returns the pending user data.
 */
export async function verifyOtp(email: string, providedOtp: string): Promise<OtpData | null> {
  const data = await getRedis().get<OtpData>(email);
  
  if (!data) {
    // Key doesn't exist or has expired
    return null;
  }

  if (data.otp !== providedOtp) {
    return null;
  }

  return data;
}

/**
 * Deletes the OTP data from Redis.
 * Useful for cleanup if email sending fails or immediately after successful verification.
 */
export async function deleteOtp(email: string) {
  await getRedis().del(email);
}

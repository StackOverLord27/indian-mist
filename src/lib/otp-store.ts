import { requireRedis } from '@/lib/redis'
import { timingSafeEqual } from 'crypto'

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
  const redis = requireRedis();
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
  const redis = requireRedis();
  const data = await redis.get<OtpData>(otpKey(purpose, email));

  if (!data) return null;

  // One atomic step: add one and make sure the counter expires (never left without a time limit)
  const [attempts] = await redis
    .multi()
    .incr(attemptsKey(purpose, email))
    .expire(attemptsKey(purpose, email), OTP_TTL_SECONDS, "NX")
    .exec<[number, number]>();
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
  await requireRedis().del(otpKey(purpose, email), attemptsKey(purpose, email));
}

/**
 * Checks if an OTP already exists for the given email.
 * Useful for preventing rapid overlapping requests.
 */
export async function checkOtpExists(purpose: OtpPurpose, email: string): Promise<boolean> {
  const data = await requireRedis().get<OtpData>(otpKey(purpose, email));
  return !!data;
}

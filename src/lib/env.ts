/**
 * Server-side environment access.
 *
 * Every variable is read lazily, when the code that needs it runs, never at import time. That
 * keeps `next build` independent of payment, mail and Redis credentials: only the variables a
 * request actually uses must exist, and a missing one fails that request loudly.
 *
 * Errors name the variable but never print its value.
 * There are no silent fallbacks: a default exists only where the variable is documented as
 * optional (see `.env.example` and `docs/env.md`).
 */

export class EnvError extends Error {
  constructor(public readonly variable: string, reason = "is not set") {
    super(`Environment variable ${variable} ${reason}. See docs/env.md.`);
    this.name = "EnvError";
  }
}

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string): string {
  const value = read(name);
  if (!value) throw new EnvError(name);
  return value;
}

export const isProduction = () => process.env.NODE_ENV === "production";

// ─── Database ───────────────────────────────────────────────────────────────

export const getMongoUri = () => required("MONGODB_URI");

// ─── Auth ───────────────────────────────────────────────────────────────────

export const getJwtAccessSecret = () => required("JWT_ACCESS_SECRET");
export const getJwtRefreshSecret = () => required("JWT_REFRESH_SECRET");

/** The one admin account. Optional: without it nobody can sign in as admin. Not normalised here, see lib/roles.ts. */
export const getSuperAdminEmailRaw = () => read("SUPER_ADMIN_EMAIL");

// ─── Redis (Upstash) ────────────────────────────────────────────────────────

export type RedisConfig = { url: string; token: string };

/** The Redis settings, or null when they are missing or still the "your_..." placeholder. */
export function getRedisConfig(): RedisConfig | null {
  const url = read("UPSTASH_REDIS_REST_URL");
  const token = read("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token || url.startsWith("your_")) return null;
  return { url, token };
}

/** Like getRedisConfig, but a missing setting is an error that names the variable. */
export function requireRedisConfig(): RedisConfig {
  const url = required("UPSTASH_REDIS_REST_URL");
  const token = required("UPSTASH_REDIS_REST_TOKEN");
  if (url.startsWith("your_")) throw new EnvError("UPSTASH_REDIS_REST_URL", "still has its placeholder value");
  return { url, token };
}

// ─── Razorpay ───────────────────────────────────────────────────────────────

export const getRazorpayKeyId = () => required("RAZORPAY_KEY_ID");
export const getRazorpayKeySecret = () => required("RAZORPAY_KEY_SECRET");
export const getRazorpayWebhookSecret = () => required("RAZORPAY_WEBHOOK_SECRET");

// ─── Cloudinary ─────────────────────────────────────────────────────────────

export function getCloudinaryConfig() {
  return {
    cloud_name: required("CLOUDINARY_CLOUD_NAME"),
    api_key: required("CLOUDINARY_API_KEY"),
    api_secret: required("CLOUDINARY_API_SECRET"),
  };
}

// ─── Mail (SMTP) ────────────────────────────────────────────────────────────

export function getSmtpConfig() {
  const port = Number.parseInt(read("SMTP_PORT") ?? "587", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EnvError("SMTP_PORT", "is not a valid port number");
  return {
    host: required("SMTP_HOST"),
    port,
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    from: required("SMTP_FROM"),
  };
}

/** Address that receives contact-form messages when none is saved in the admin settings. */
export const getFallbackContactEmail = () => getSuperAdminEmailRaw() ?? read("SMTP_USER");

/**
 * Shared settings and SAFETY CHECKS for the end-to-end tests.
 *
 * The tests only ever talk to: a LOCAL throwaway MongoDB database, Razorpay TEST MODE, and the
 * dev Upstash Redis the owner confirmed. Anything else makes them refuse to run. Key values are
 * never printed.
 */
import path from "node:path";

export const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;
export const E2E_DB = "indianmist_e2e";
export const MONGO_URI =
  process.env.E2E_MONGODB_URI ?? `mongodb://127.0.0.1:27018/${E2E_DB}?replicaSet=rs0&directConnection=true`;
export const ARTIFACTS = path.resolve(process.cwd(), "e2e-artifacts");
export const AUTH_DIR = path.join(ARTIFACTS, "auth");

// Throwaway values that exist only for the e2e app process (never real secrets)
export const E2E_JWT_ACCESS = "e2e-only-access-secret-not-a-real-secret-0123456789";
export const E2E_JWT_REFRESH = "e2e-only-refresh-secret-not-a-real-secret-0123456789";

export const ADMIN = { email: "e2e-admin@example.test", password: "E2e-Admin-Pass-1!", name: "E2E Admin" };
export const CUSTOMER_A = { email: "e2e-customer-a@example.test", password: "E2e-Customer-Pass-1!", name: "Ada Customer", phone: "9811122233" };
export const CUSTOMER_B = { email: "e2e-customer-b@example.test", password: "E2e-Customer-Pass-2!", name: "Ben Customer", phone: "9822233344" };

/** Reads .env for the Razorpay / Upstash values only (never MONGODB_URI), without printing anything. */
export function loadSharedEnv() {
  const wanted = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_WEBHOOK_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  if (wanted.some((k) => !process.env[k])) {
    const saved: Record<string, string | undefined> = { MONGODB_URI: process.env.MONGODB_URI };
    try { process.loadEnvFile(".env"); } catch { /* reported by assertSafe */ }
    // never let .env bring a database address in
    if (saved.MONGODB_URI === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = saved.MONGODB_URI;
  }
}

export function assertSafe() {
  loadSharedEnv();
  for (const name of ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID"]) {
    const v = process.env[name];
    if (v && !v.startsWith("rzp_test_")) {
      throw new Error(`REFUSING TO RUN: ${name} does not start with rzp_test_ (prefix: ${v.split("_").slice(0, 2).join("_")}). Remove any live key from the local environment.`);
    }
  }
  for (const name of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    if (!process.env[name]) throw new Error(`Missing ${name} (expected in .env or the environment).`);
  }
  const host = new URL(MONGO_URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || MONGO_URI.startsWith("mongodb+srv:")) {
    throw new Error(`REFUSING TO RUN: the e2e database host "${host}" is not local.`);
  }
}

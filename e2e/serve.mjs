#!/usr/bin/env node
/**
 * Starts the app for the end-to-end tests: a production build and `next start`, pointed at the
 * LOCAL e2e database (never Atlas). Razorpay / Upstash values come from .env. Used by the
 * Playwright `webServer` setting; E2E_SKIP_BUILD=1 reuses the last build.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = process.env.E2E_PORT ?? "3100";
const MONGO_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27018/indianmist_e2e?replicaSet=rs0&directConnection=true";

const host = new URL(MONGO_URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || MONGO_URI.startsWith("mongodb+srv:")) {
  console.error(`REFUSING TO START: e2e database host "${host}" is not local.`);
  process.exit(2);
}
// Read the shared values from .env (Razorpay test keys, Upstash) but never the database address
try { const saved = process.env.MONGODB_URI; process.loadEnvFile(".env"); if (saved === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = saved; } catch { /* checked below */ }
for (const name of ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID"]) {
  const v = process.env[name];
  if (v && !v.startsWith("rzp_test_")) { console.error(`REFUSING TO START: ${name} is not an rzp_test_ key.`); process.exit(2); }
}

const env = {
  ...process.env,
  MONGODB_URI: MONGO_URI,
  JWT_ACCESS_SECRET: "e2e-only-access-secret-not-a-real-secret-0123456789",
  JWT_REFRESH_SECRET: "e2e-only-refresh-secret-not-a-real-secret-0123456789",
  SUPER_ADMIN_EMAIL: "e2e-admin@example.test",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NODE_ENV: "production",
};

if (process.env.E2E_SKIP_BUILD !== "1" || !existsSync(".next/BUILD_ID")) {
  const build = spawnSync("npx", ["next", "build"], { env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const server = spawn("npx", ["next", "start", "-p", PORT], { env, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
server.on("exit", (code) => process.exit(code ?? 0));

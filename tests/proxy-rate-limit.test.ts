import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ratelimitState } from "./helpers/redis";

vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("@upstash/ratelimit", async () => (await import("./helpers/redis")).ratelimitModuleMock());

import { proxy } from "@/proxy";
import { resetRedisForTests } from "@/lib/redis";
import { resetRateLimitersForTests } from "@/lib/rate-limit";

const req = (path: string, ip = "9.9.9.9") =>
  new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "x-vercel-forwarded-for": ip } });

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ratelimitState.reset();
  resetRedisForTests();
  resetRateLimitersForTests();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy picks the right limiter", () => {
  it("auth limiter for every credential/OTP path including forgot-password/*", async () => {
    for (const path of [
      "/api/auth/signin",
      "/api/auth/signup",
      "/api/auth/verify-otp",
      "/api/auth/forgot-password/request-otp",
      "/api/auth/forgot-password/reset",
    ]) {
      ratelimitState.calls = [];
      await proxy(req(path));
      expect(ratelimitState.calls, path).toEqual(["@upstash/ratelimit/auth|9.9.9.9"]);
    }
  });

  it("form limiter, counted per route, for contact and subscribe", async () => {
    await proxy(req("/api/contact"));
    await proxy(req("/api/subscribe"));
    expect(ratelimitState.calls).toEqual([
      "@upstash/ratelimit/form|/api/contact:9.9.9.9",
      "@upstash/ratelimit/form|/api/subscribe:9.9.9.9",
    ]);
  });

  it("general limiter for everything else under /api, none for pages", async () => {
    await proxy(req("/api/products"));
    expect(ratelimitState.calls).toEqual(["@upstash/ratelimit/general|9.9.9.9"]);
    ratelimitState.calls = [];
    await proxy(req("/about"));
    expect(ratelimitState.calls).toEqual([]);
  });

  it("answers 429 with Retry-After when limited", async () => {
    ratelimitState.blocked = true;
    const res = await proxy(req("/api/auth/forgot-password/reset"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });
});

describe("when Redis is missing or down", () => {
  it("development without Redis config: requests pass and a clear warning is logged once", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const a = await proxy(req("/api/auth/signin", "8.8.8.8"));
    const b = await proxy(req("/api/contact", "8.8.8.8"));
    const c = await proxy(req("/api/products", "8.8.8.8"));
    for (const r of [a, b, c]) expect(r.status).not.toBe(429);
    const warnings = warn.mock.calls.filter((call: unknown[]) => String(call[0]).startsWith("[redis]"));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0][0])).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("production without Redis config: auth/form routes fail closed (503), general routes fail open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect((await proxy(req("/api/auth/signin"))).status).toBe(503);
    expect((await proxy(req("/api/auth/forgot-password/request-otp"))).status).toBe(503);
    expect((await proxy(req("/api/contact"))).status).toBe(503);
    expect((await proxy(req("/api/products"))).status).not.toBe(503);
    // the log names the variable, not a value
    expect(error.mock.calls.flat().map(String).join(" ")).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("production with Redis erroring: same split", async () => {
    vi.stubEnv("NODE_ENV", "production");
    ratelimitState.failing = true;
    expect((await proxy(req("/api/auth/signin"))).status).toBe(503);
    expect((await proxy(req("/api/subscribe"))).status).toBe(503);
    expect((await proxy(req("/api/products"))).status).not.toBe(503);
  });

  it("development with Redis erroring: everything passes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    ratelimitState.failing = true;
    expect((await proxy(req("/api/auth/signin", "7.7.7.7"))).status).not.toBe(503);
  });
});

describe("a missing JWT secret is reported, not silently treated as empty", () => {
  it("returns a 500 that names nothing sensitive for protected routes", async () => {
    vi.stubEnv("JWT_ACCESS_SECRET", "");
    const res = await proxy(req("/api/checkout/create-order"));
    expect(res.status).toBe(500);
    expect(error.mock.calls.flat().map(String).join(" ")).toContain("JWT_ACCESS_SECRET");
  });
});

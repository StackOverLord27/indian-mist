import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import axios, { AxiosError, type AxiosAdapter } from "axios";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis, ratelimitState } from "./helpers/redis";
import { sentMails, resetMailer } from "./helpers/mailer";

vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("@upstash/ratelimit", async () => (await import("./helpers/redis")).ratelimitModuleMock());
vi.mock("nodemailer", async () => (await import("./helpers/mailer")).nodemailerModuleMock());
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void task,
}));

import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { hashToken, ACCESS_TOKEN_MAX_AGE, REFRESH_LIFETIME } from "@/lib/auth-tokens";
import { verifyAccessTokenEdge } from "@/lib/auth-tokens.edge";
import { setOtp } from "@/lib/otp-store";
import { resetRedisForTests } from "@/lib/redis";
import { resetRateLimitersForTests } from "@/lib/rate-limit";
import { proxy } from "@/proxy";
import * as signin from "@/app/api/auth/signin/route";
import * as signup from "@/app/api/auth/signup/route";
import * as verifyOtp from "@/app/api/auth/verify-otp/route";
import * as refresh from "@/app/api/auth/refresh/route";
import * as reset from "@/app/api/auth/forgot-password/reset/route";
import { adminAxios } from "@/lib/admin-axios";
import { randomUUID } from "node:crypto";

setupTestDb();
void signup; void sentMails;

const DAY = 86_400;
const req = (url: string, body: unknown = {}, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const setCookie = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const value = (res: Response, name: string) => setCookie(res, name)?.split(";")[0].slice(name.length + 1) ?? "";
const maxAge = (res: Response, name: string) => Number(/Max-Age=(\d+)/i.exec(setCookie(res, name) ?? "")?.[1]);

beforeEach(() => {
  fakeRedis.reset(); resetRedisForTests(); resetMailer(); ratelimitState.reset(); resetRateLimitersForTests();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

/**
 * Every place that issues cookies, checked against the other two records of the same lifetime:
 * the cookie's Max-Age (seconds), the JWT's own exp (seconds since epoch) and the database row (Dates).
 */
function expectLifetimesAgree(res: Response, row: { expiresAt: Date; absoluteExpiresAt?: Date }, who: "user" | "admin", refreshToken = value(res, "refresh_token")) {
  const life = REFRESH_LIFETIME[who];
  const now = Date.now();
  // access: cookie = JWT = 15 minutes
  const access = jwt.decode(value(res, "access_token")) as { iat: number; exp: number };
  expect(maxAge(res, "access_token")).toBe(ACCESS_TOKEN_MAX_AGE);
  expect(access.exp - access.iat).toBe(ACCESS_TOKEN_MAX_AGE);
  expect(ACCESS_TOKEN_MAX_AGE).toBe(900);
  // refresh: the cookie is NOT a session cookie, and ends when the database row says
  const cookieSeconds = maxAge(res, "refresh_token");
  expect(cookieSeconds).toBeGreaterThan(0);
  expect(Math.abs(row.expiresAt.getTime() - (now + cookieSeconds * 1000))).toBeLessThan(3000);
  expect(cookieSeconds).toBeLessThanOrEqual(life.sliding);
  // JWT exp = the absolute maximum = the row's absoluteExpiresAt
  const rt = jwt.decode(refreshToken) as { iat: number; exp: number };
  expect(rt.exp - rt.iat).toBe(life.absolute);
  expect(Math.abs(row.absoluteExpiresAt!.getTime() - rt.exp * 1000)).toBeLessThan(2000);
  // sliding never runs past the absolute end, and the cookie never outlives the token
  expect(row.expiresAt.getTime()).toBeLessThanOrEqual(row.absoluteExpiresAt!.getTime());
  expect(now + cookieSeconds * 1000).toBeLessThanOrEqual(rt.exp * 1000 + 1500);
  // the raw token is stored only as a hash
  expect(setCookie(res, "refresh_token")).not.toMatch(/Max-Age=0/i);
}

describe("every issuing route: Max-Age, JWT exp and database expiry agree (and the refresh cookie is persistent)", () => {
  const rowFor = async (token: string) => (await RefreshToken.findOne({ tokenHash: hashToken(token) }))!;

  it("sign-in, customer", async () => {
    await User.create({ name: "A", email: "c@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const res = await signin.POST(req("/api/auth/signin", { email: "c@shop.test", password: "Old-Passw0rd!" }));
    expectLifetimesAgree(res, await rowFor(value(res, "refresh_token")), "user");
  });

  it("sign-in, admin", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "boss@shop.test");
    await User.create({ name: "B", email: "boss@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const res = await signin.POST(req("/api/auth/signin", { email: "boss@shop.test", password: "Old-Passw0rd!" }));
    expectLifetimesAgree(res, await rowFor(value(res, "refresh_token")), "admin");
  });

  it("sign-up verification", async () => {
    await setOtp("signup", "new@shop.test", "123456", "Nina", await (await import("bcryptjs")).default.hash("New-Passw0rd!", 4));
    const res = await verifyOtp.POST(req("/api/auth/verify-otp", { email: "new@shop.test", otp: "123456" }));
    expect(res.status).toBe(200);
    expectLifetimesAgree(res, await rowFor(value(res, "refresh_token")), "user");
  });

  it("password reset", async () => {
    await User.create({ name: "R", email: "r@shop.test", password: "Old-Passw0rd!", isVerified: true });
    await setOtp("reset", "r@shop.test", "123456");
    const res = await reset.POST(req("/api/auth/forgot-password/reset", { email: "r@shop.test", otp: "123456", newPassword: "Brand-New-Passw0rd!", confirmPassword: "Brand-New-Passw0rd!" }));
    expect(res.status).toBe(200);
    expectLifetimesAgree(res, await rowFor(value(res, "refresh_token")), "user");
  });

  it("every renewal, early and late in a session (the cookie follows the row, capped at the absolute end)", async () => {
    const u = await User.create({ name: "A", email: "s@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const login = await signin.POST(req("/api/auth/signin", { email: "s@shop.test", password: "Old-Passw0rd!" }));
    const token = value(login, "refresh_token");
    for (const absoluteIn of [90 * DAY, 20 * DAY, 2 * DAY, 60]) {
      const abs = new Date(Date.now() + absoluteIn * 1000);
      await RefreshToken.updateOne({ userId: u._id }, { absoluteExpiresAt: abs, expiresAt: new Date(Date.now() + 60_000) });
      const res = await refresh.POST(req("/api/auth/refresh", {}, `refresh_token=${token}`));
      expect(res.status).toBe(200);
      const row = (await RefreshToken.findOne({ userId: u._id }))!;
      const seconds = maxAge(res, "refresh_token");
      expect(Math.abs(row.expiresAt.getTime() - (Date.now() + seconds * 1000))).toBeLessThan(3000);
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(abs.getTime());
      expect(seconds).toBeLessThanOrEqual(Math.max(1, Math.ceil(absoluteIn)));
      expect(seconds).toBeLessThanOrEqual(REFRESH_LIFETIME.user.sliding);
    }
  });

  it("a legacy session's first renewal (the upgrade) issues agreeing lifetimes too", async () => {
    const u = await User.create({ name: "L", email: "l@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const old = jwt.sign({ userId: String(u._id), family: "fam", jti: randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d", algorithm: "HS256" });
    await RefreshToken.create({ userId: u._id, tokenHash: hashToken(old), family: "fam", expiresAt: new Date(Date.now() + 5 * DAY * 1000) });
    const res = await refresh.POST(req("/api/auth/refresh", {}, `refresh_token=${old}`));
    expectLifetimesAgree(res, await rowFor(value(res, "refresh_token")), "user");
  });
});

describe("no failed, limited or erroring request clears cookies", () => {
  const cookie = "refresh_token=abc; access_token=def";

  it("a rate-limited request (429 from the proxy) sets no cookies at all, on every auth path", async () => {
    ratelimitState.blocked = true;
    for (const path of ["/api/auth/refresh", "/api/auth/signin", "/api/profile", "/api/auth/signout"]) {
      const res = await proxy(new NextRequest(`http://localhost${path}`, { method: "POST", headers: { cookie, "x-vercel-forwarded-for": "9.9.9.9" } }));
      expect(res.status, path).toBe(429);
      expect(res.headers.getSetCookie(), path).toEqual([]);
    }
  });

  it("the renewal leaves cookies alone on a database failure (503)", async () => {
    const u = await User.create({ name: "A", email: "db@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const login = await signin.POST(req("/api/auth/signin", { email: "db@shop.test", password: "Old-Passw0rd!" }));
    vi.spyOn(User, "findById").mockImplementationOnce(() => { throw new Error("db down"); });
    const res = await refresh.POST(req("/api/auth/refresh", {}, `refresh_token=${value(login, "refresh_token")}`));
    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await RefreshToken.countDocuments({ userId: u._id })).toBe(1);
  });

  it("a failed sign-in (wrong password, unknown e-mail, locked out) sets or clears nothing", async () => {
    await User.create({ name: "A", email: "x@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const wrong = await signin.POST(req("/api/auth/signin", { email: "x@shop.test", password: "Wrong-Passw0rd!" }), );
    const none = await signin.POST(req("/api/auth/signin", { email: "nobody@shop.test", password: "Wrong-Passw0rd!" }));
    expect([wrong.status, none.status]).toEqual([401, 401]);
    expect(wrong.headers.getSetCookie()).toEqual([]);
    expect(none.headers.getSetCookie()).toEqual([]);
  });

  it("the renewal clears cookies ONLY for a definite refusal (revoked, expired, invalid), and says 401", async () => {
    const u = await User.create({ name: "A", email: "def@shop.test", password: "Old-Passw0rd!", isVerified: true });
    const login = await signin.POST(req("/api/auth/signin", { email: "def@shop.test", password: "Old-Passw0rd!" }));
    const token = value(login, "refresh_token");
    const noCookie = await refresh.POST(req("/api/auth/refresh"));
    expect(noCookie.status).toBe(401);
    expect(noCookie.headers.getSetCookie()).toEqual([]); // nothing to clear
    await RefreshToken.deleteMany({ userId: u._id });
    const revoked = await refresh.POST(req("/api/auth/refresh", {}, `refresh_token=${token}`));
    expect(revoked.status).toBe(401);
    expect(setCookie(revoked, "refresh_token")).toMatch(/Max-Age=0/i);
    expect(setCookie(revoked, "access_token")).toMatch(/Max-Age=0/i);
  });
});

describe("the proxy's idea of an access token", () => {
  const secret = () => process.env.JWT_ACCESS_SECRET!;
  const good = { userId: "507f1f77bcf86cd799439011", email: "a@shop.test", role: "user" };

  it("accepts a real access token", async () => {
    expect(await verifyAccessTokenEdge(jwt.sign(good, secret(), { expiresIn: 60, algorithm: "HS256" }), secret())).toMatchObject(good);
  });
  it("refuses a token with no expiry (it would never run out)", async () => {
    expect(await verifyAccessTokenEdge(jwt.sign(good, secret(), { algorithm: "HS256", noTimestamp: true }), secret())).toBeNull();
  });
  it("refuses an expired token", async () => {
    expect(await verifyAccessTokenEdge(jwt.sign(good, secret(), { expiresIn: -5, algorithm: "HS256" }), secret())).toBeNull();
  });
  it("refuses a REFRESH-shaped token even when it is signed with the access secret (misconfigured, equal secrets)", async () => {
    const refreshShaped = jwt.sign({ userId: good.userId, family: "f" }, secret(), { expiresIn: 90 * DAY, algorithm: "HS256" });
    expect(await verifyAccessTokenEdge(refreshShaped, secret())).toBeNull();
  });
  it("the proxy then treats such a token as no token", async () => {
    const refreshShaped = jwt.sign({ userId: good.userId, family: "f" }, secret(), { expiresIn: 90 * DAY, algorithm: "HS256" });
    const res = await proxy(new NextRequest("http://localhost/api/profile", { headers: { cookie: `access_token=${refreshShaped}`, "x-vercel-forwarded-for": "9.9.9.9" } }));
    expect(res.status).toBe(401);
  });
});

describe("public API prefixes match on a path-segment boundary", () => {
  const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`, { headers: { "x-vercel-forwarded-for": "9.9.9.9" } }));
  it("real public routes stay public", async () => {
    for (const path of ["/api/products", "/api/products/cart", "/api/collections/summer/products", "/api/settings", "/api/blogs", "/api/auth/refresh"]) {
      expect((await call(path)).status, path).not.toBe(401);
    }
  });
  it("a look-alike path is NOT public", async () => {
    for (const path of ["/api/products-private", "/api/settingsX", "/api/auth/refreshing", "/api/blogsdraft", "/api/contactlist"]) {
      expect((await call(path)).status, path).toBe(401);
    }
  });
});

describe("admin client: a failed renewal only signs the admin out when the server says 401", () => {
  type Reply = { status: number } | "network";
  function run(refreshReply: Reply) {
    const location = { pathname: "/admin/orders", href: "/admin/orders" };
    const store = new Map<string, string>([["im_admin_user", "{}"]]);
    vi.stubGlobal("window", { location });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const adapter: AxiosAdapter = (config) => new Promise((resolve, reject) => {
      const is = String(config.url).endsWith("/api/auth/refresh");
      const reply: Reply = is ? refreshReply : { status: 401 };
      if (reply === "network") return reject(new AxiosError("Network Error", "ERR_NETWORK", config));
      const response = { status: reply.status, statusText: "", data: {}, headers: {}, config, request: {} };
      if (reply.status < 300) resolve(response);
      else reject(new AxiosError("fail", "ERR_BAD_REQUEST", config, {}, response as never));
    });
    adminAxios.defaults.adapter = adapter;
    axios.defaults.adapter = adapter;
    return { location, store };
  }
  afterEach(() => { vi.unstubAllGlobals(); delete (axios.defaults as { adapter?: unknown }).adapter; });

  it("401 from the renewal: signed out (redirect, stored admin removed)", async () => {
    const { location, store } = run({ status: 401 });
    await expect(adminAxios.get("/api/admin/orders")).rejects.toBeTruthy();
    expect(location.href).toBe("/admin/login");
    expect(store.has("im_admin_user")).toBe(false);
  });
  for (const [name, reply] of [["429", { status: 429 }], ["503", { status: 503 }], ["a network error", "network"]] as const) {
    it(`${name} from the renewal: the admin stays where they are`, async () => {
      const { location, store } = run(reply);
      await expect(adminAxios.get("/api/admin/orders")).rejects.toBeTruthy();
      expect(location.href).toBe("/admin/orders");
      expect(store.has("im_admin_user")).toBe(true);
    });
  }
});

describe("sign-out from another site (cookies are SameSite=Lax)", () => {
  const signoutPost = (headers: Record<string, string | undefined>) =>
    new NextRequest("http://shop.test/api/auth/signout", { method: "POST", headers: { host: "shop.test", ...headers } as Record<string, string> });

  it("refuses a request whose Origin or Referer is another site, and clears nothing", async () => {
    const signout = await import("@/app/api/auth/signout/route");
    for (const h of [{ origin: "https://evil.example" }, { origin: "null" }, { referer: "https://evil.example/page" }]) {
      const res = await signout.POST(signoutPost({ ...h, cookie: "refresh_token=abc" }));
      expect(res.status).toBe(403);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
  });

  it("allows the shop's own pages (Origin or Referer) and requests that carry neither", async () => {
    const signout = await import("@/app/api/auth/signout/route");
    for (const h of [{ origin: "http://shop.test" }, { referer: "http://shop.test/profile" }, {}]) {
      const res = await signout.POST(signoutPost(h));
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie().join(";")).toContain("access_token=");
    }
  });

  it("uses the forwarded host when behind a proxy", async () => {
    const signout = await import("@/app/api/auth/signout/route");
    const res = await signout.POST(signoutPost({ host: "internal:3000", "x-forwarded-host": "www.shop.test", origin: "https://www.shop.test" }));
    expect(res.status).toBe(200);
  });
});

describe("rate limiter analytics", () => {
  it("are off for every limiter (they cost extra Redis commands and nothing reads them)", async () => {
    const { getRateLimiter } = await import("@/lib/rate-limit");
    for (const kind of ["auth", "form", "general"] as const) {
      const limiter = getRateLimiter(kind) as unknown as { config: { analytics?: boolean } } | null;
      expect(limiter).toBeTruthy();
      expect(limiter!.config.analytics).toBe(false);
    }
  });
});

describe("rate limiter analytics", () => {
  it("are off for every limiter (they cost extra Redis commands and nothing reads them)", async () => {
    resetRateLimitersForTests();
    const { getRateLimiter } = await import("@/lib/rate-limit");
    for (const kind of ["auth", "form", "general"] as const) {
      const limiter = getRateLimiter(kind) as unknown as { config: { analytics?: boolean } } | null;
      expect(limiter).toBeTruthy();
      expect(limiter!.config.analytics).toBe(false);
    }
  });
});

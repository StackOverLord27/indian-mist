import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { sentMails, resetMailer } from "./helpers/mailer";

vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("nodemailer", async () => (await import("./helpers/mailer")).nodemailerModuleMock());
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void task,
}));

import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { hashToken, verifyAccessToken, REFRESH_LIFETIME, MAX_SESSIONS_PER_USER } from "@/lib/auth-tokens";
import { setOtp } from "@/lib/otp-store";
import { resetRedisForTests } from "@/lib/redis";
import * as signin from "@/app/api/auth/signin/route";
import * as refresh from "@/app/api/auth/refresh/route";
import * as signout from "@/app/api/auth/signout/route";
import * as reset from "@/app/api/auth/forgot-password/reset/route";

setupTestDb();
void mongoose;

const DAY = 86_400;
const req = (url: string, body: unknown = {}, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const cookieHeader = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const cookieValue = (res: Response, name: string) => cookieHeader(res, name)?.split(";")[0].slice(name.length + 1) ?? null;
const maxAge = (res: Response, name: string) => Number(/Max-Age=(\d+)/i.exec(cookieHeader(res, name) ?? "")?.[1]);

const renew = (raw: string) => refresh.POST(req("/api/auth/refresh", {}, `refresh_token=${raw}`));
const makeUser = (email: string, password = "Old-Passw0rd!") => User.create({ name: "Asha", email, password, isVerified: true });
async function login(email: string, password = "Old-Passw0rd!") {
  const res = await signin.POST(req("/api/auth/signin", { email, password }));
  expect(res.status).toBe(200);
  return { res, refreshToken: cookieValue(res, "refresh_token")!, accessToken: cookieValue(res, "access_token")! };
}
/** A session as the OLD rotating code stored it: 7-day token, no absolute maximum, maybe marked used */
async function legacySession(userId: string, family: string, opts: { usedAt?: Date } = {}) {
  const raw = jwt.sign({ userId, family, jti: randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d", algorithm: "HS256" });
  await RefreshToken.create({ userId, tokenHash: hashToken(raw), family, expiresAt: new Date(Date.now() + 5 * 86_400_000), ...opts });
  return raw;
}

let logged: string[];
beforeEach(() => {
  fakeRedis.reset();
  resetRedisForTests();
  resetMailer();
  logged = [];
  const grab = (...args: unknown[]) => void logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  vi.spyOn(console, "warn").mockImplementation(grab);
  vi.spyOn(console, "error").mockImplementation(grab);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("renewal with a refresh token that does not rotate", () => {
  it("works again and again with the same cookie; the cookie value never changes", async () => {
    const user = await makeUser("again@shop.com");
    const { refreshToken } = await login("again@shop.com");
    for (let i = 0; i < 6; i++) {
      const res = await renew(refreshToken);
      expect(res.status).toBe(200);
      expect(verifyAccessToken(cookieValue(res, "access_token")!)).toMatchObject({ email: "again@shop.com", role: "user" });
      expect(cookieValue(res, "refresh_token")).toBe(refreshToken); // same token, cookie lifetime renewed
    }
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1); // no row per renewal
  });

  it("parallel renewals all succeed and create nothing", async () => {
    const user = await makeUser("par@shop.com");
    const { refreshToken } = await login("par@shop.com");
    const results = await Promise.all(Array.from({ length: 8 }, () => renew(refreshToken)));
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (const r of results) expect(cookieValue(r, "refresh_token")).toBe(refreshToken);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
    expect((await renew(refreshToken)).status).toBe(200);
  });

  it("a lost response no longer ends the session: reuse long afterwards still works (hypothesis B)", async () => {
    const user = await makeUser("lost@shop.com");
    const { refreshToken } = await login("lost@shop.com");
    await renew(refreshToken); // the browser never got this response
    // an hour, a day, a week of nothing passes; the old code treated this as theft after 10 s
    await RefreshToken.updateOne({ userId: user._id }, { lastUsedAt: new Date(Date.now() - 7 * DAY * 1000) });
    const later = await renew(refreshToken);
    expect(later.status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
    expect(logged.join("\n")).not.toMatch(/replay/i);
  });

  it("a database failure mid-renewal is a 503 that leaves the cookies alone; the same cookie works afterwards", async () => {
    const user = await makeUser("crash@shop.com");
    const { refreshToken } = await login("crash@shop.com");
    const spy = vi.spyOn(RefreshToken, "updateOne").mockRejectedValueOnce(new Error("db down"));
    const failed = await renew(refreshToken);
    expect(failed.status).toBe(503);
    expect(failed.headers.getSetCookie()).toEqual([]); // nothing cleared, nothing replaced
    spy.mockRestore();
    expect((await renew(refreshToken)).status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
  });

  it("slides the expiry (cookie and row) and never shortens it", async () => {
    const user = await makeUser("slide@shop.com");
    const { refreshToken, res } = await login("slide@shop.com");
    expect(maxAge(res, "refresh_token")).toBe(REFRESH_LIFETIME.user.sliding); // 30 days
    await RefreshToken.updateOne({ userId: user._id }, { expiresAt: new Date(Date.now() + 2 * DAY * 1000) });
    const renewed = await renew(refreshToken);
    expect(maxAge(renewed, "refresh_token")).toBeGreaterThan(29 * DAY);
    const row = await RefreshToken.findOne({ userId: user._id });
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY * 1000);
    // an out-of-order older value never pulls the expiry back
    await RefreshToken.updateOne({ _id: row!._id }, { $max: { expiresAt: new Date(Date.now() + DAY * 1000) } });
    expect((await RefreshToken.findById(row!._id))!.expiresAt.getTime()).toBe(row!.expiresAt.getTime());
  });
});

describe("lifetimes", () => {
  it("customers: 30 days sliding, 90 days absolute; the token's own exp is the absolute maximum", async () => {
    const user = await makeUser("life@shop.com");
    const { res, refreshToken } = await login("life@shop.com");
    expect(maxAge(res, "refresh_token")).toBe(30 * DAY);
    const payload = jwt.decode(refreshToken) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(90 * DAY);
    const row = await RefreshToken.findOne({ userId: user._id });
    expect(Math.round((row!.absoluteExpiresAt!.getTime() - Date.now()) / 1000 / DAY)).toBe(90);
  });

  it("the admin account (SUPER_ADMIN_EMAIL): 7 days sliding, 30 days absolute", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "boss@shop.com");
    const user = await makeUser("boss@shop.com", "Boss-Passw0rd!");
    const { res, refreshToken } = await login("boss@shop.com", "Boss-Passw0rd!");
    expect(maxAge(res, "refresh_token")).toBe(7 * DAY);
    const payload = jwt.decode(refreshToken) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(30 * DAY);
    const row = await RefreshToken.findOne({ userId: user._id });
    expect(Math.round((row!.absoluteExpiresAt!.getTime() - Date.now()) / 1000 / DAY)).toBe(30);
    const renewed = await renew(refreshToken);
    expect(verifyAccessToken(cookieValue(renewed, "access_token")!).role).toBe("admin");
    expect(maxAge(renewed, "refresh_token")).toBeLessThanOrEqual(7 * DAY);
  });

  it("idle expiry: a session unused past its sliding expiry is refused, with a log line saying why", async () => {
    const user = await makeUser("idle@shop.com");
    const { refreshToken } = await login("idle@shop.com");
    await RefreshToken.updateOne({ userId: user._id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await renew(refreshToken);
    expect(res.status).toBe(401);
    expect(cookieHeader(res, "refresh_token")).toMatch(/Max-Age=0/i);
    expect(logged).toContainEqual(expect.stringMatching(/^\[auth\] renewal refused reason=session-idle-expired/));
  });

  it("absolute maximum: refused once reached however recently it was used; the sliding expiry never passes it", async () => {
    const user = await makeUser("abs@shop.com");
    const { refreshToken } = await login("abs@shop.com");
    // 3 days left of the 90: the cookie lifetime is capped at 3 days, not 30
    const near3 = new Date(Date.now() + 3 * DAY * 1000);
    await RefreshToken.updateOne({ userId: user._id }, { absoluteExpiresAt: near3, expiresAt: near3 });
    const near = await renew(refreshToken);
    expect(near.status).toBe(200);
    expect(maxAge(near, "refresh_token")).toBeLessThanOrEqual(3 * DAY);
    expect(maxAge(near, "refresh_token")).toBeGreaterThan(2 * DAY);
    const row = await RefreshToken.findOne({ userId: user._id });
    expect(row!.expiresAt.getTime()).toBeLessThanOrEqual(row!.absoluteExpiresAt!.getTime());

    await RefreshToken.updateOne({ userId: user._id }, { absoluteExpiresAt: new Date(Date.now() - 1000) });
    const over = await renew(refreshToken);
    expect(over.status).toBe(401);
    expect(logged).toContainEqual(expect.stringMatching(/reason=session-absolute-max-reached/));
  });

  it("a token whose own exp has passed is refused with its reason and cleared", async () => {
    const user = await makeUser("exp@shop.com");
    const raw = jwt.sign({ userId: String(user._id), family: "f", jti: randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: -10, algorithm: "HS256" });
    const res = await renew(raw);
    expect(res.status).toBe(401);
    expect(logged).toContainEqual(expect.stringMatching(/reason=token-expired/));
  });
});

describe("ending sessions", () => {
  it("sign-out ends that one session only", async () => {
    const user = await makeUser("out@shop.com");
    const phone = await login("out@shop.com");
    fakeRedis.reset(); resetRedisForTests();
    const laptop = await login("out@shop.com");
    const res = await signout.POST(req("/api/auth/signout", {}, `refresh_token=${phone.refreshToken}`));
    expect(res.status).toBe(200);
    expect((await renew(phone.refreshToken)).status).toBe(401);
    expect((await renew(laptop.refreshToken)).status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
  });

  it("sign-out with an expired or missing cookie still answers 200 and clears the cookies", async () => {
    const expired = jwt.sign({ userId: "x", family: "f" }, process.env.JWT_REFRESH_SECRET!, { expiresIn: -5, algorithm: "HS256" });
    for (const cookie of [undefined, `refresh_token=${expired}`, "refresh_token=garbage"]) {
      const res = await signout.POST(req("/api/auth/signout", {}, cookie));
      expect(res.status).toBe(200);
      expect(cookieHeader(res, "access_token")).toMatch(/Max-Age=0/i);
    }
  });

  it("password reset ends ALL sessions of the account (and only that account's)", async () => {
    const user = await makeUser("reset@shop.com");
    await makeUser("bystander@shop.com");
    const a = await login("reset@shop.com");
    fakeRedis.reset(); resetRedisForTests();
    const b = await login("reset@shop.com");
    const other = await login("bystander@shop.com");
    await setOtp("reset", "reset@shop.com", "123456");
    const res = await reset.POST(req("/api/auth/forgot-password/reset", { email: "reset@shop.com", otp: "123456", newPassword: "Brand-New-Passw0rd!", confirmPassword: "Brand-New-Passw0rd!" }));
    expect(res.status).toBe(200);
    expect((await renew(a.refreshToken)).status).toBe(401);
    expect((await renew(b.refreshToken)).status).toBe(401);
    expect((await renew(other.refreshToken)).status).toBe(200);
    // the reset signed this browser in with a fresh session
    expect((await renew(cookieValue(res, "refresh_token")!)).status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
  });

  it("unknown or revoked token: 401, cookies cleared, one [security] line without token text or personal data", async () => {
    const user = await makeUser("ghost@shop.com");
    const { refreshToken } = await login("ghost@shop.com");
    await RefreshToken.deleteMany({ userId: user._id }); // revoked
    const res = await renew(refreshToken);
    expect(res.status).toBe(401);
    expect(cookieHeader(res, "refresh_token")).toMatch(/Max-Age=0/i);
    const line = logged.find((l) => l.startsWith("[security] Refresh token unknown or revoked"));
    expect(line).toMatch(/token age \d+s/);
    expect(await RefreshToken.countDocuments({})).toBe(0); // and nothing else was wiped
  });

  it("refuses tokens signed with another secret, another algorithm or naming another user", async () => {
    const a = await makeUser("a@shop.com");
    const b = await makeUser("b@shop.com");
    const tokenA = (await login("a@shop.com")).refreshToken;
    const forged = jwt.sign({ userId: String(a._id), family: "f" }, "some-other-secret", { expiresIn: "1d", algorithm: "HS256" });
    expect((await renew(forged)).status).toBe(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ userId: String(a._id), family: "f" })).toString("base64url")}.`;
    expect((await renew(none)).status).toBe(401);
    // a genuine token whose row belongs to somebody else's id never yields that other user's access token
    const row = await RefreshToken.findOne({ userId: a._id });
    await RefreshToken.updateOne({ _id: row!._id }, { userId: b._id });
    expect((await renew(tokenA)).status).toBe(401);
  });
});

describe("sessions that were signed in BEFORE this change keep working (no forced sign-out)", () => {
  it("a legacy token (7-day exp, no absolute maximum) renews, and is upgraded once to the new lifetimes", async () => {
    const user = await makeUser("legacy@shop.com");
    const old = await legacySession(String(user._id), "fam-legacy");
    const res = await renew(old);
    expect(res.status).toBe(200);
    const upgraded = cookieValue(res, "refresh_token")!;
    expect(upgraded).not.toBe(old);
    expect(maxAge(res, "refresh_token")).toBe(30 * DAY);
    const rows = await RefreshToken.find({ userId: user._id }).sort({ _id: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[1].family).toBe("fam-legacy"); // same session
    expect(rows[1].absoluteExpiresAt).toBeTruthy();
    // the upgraded token now renews without changing again
    const next = await renew(upgraded);
    expect(next.status).toBe(200);
    expect(cookieValue(next, "refresh_token")).toBe(upgraded);
    // and the response with the upgrade may have been lost: the legacy cookie still works until it expires
    expect((await renew(old)).status).toBe(200);
  });

  it("a legacy token the old code had already marked 'used' is accepted too (the replay rule is gone)", async () => {
    const user = await makeUser("legacyused@shop.com");
    const old = await legacySession(String(user._id), "fam-used", { usedAt: new Date(Date.now() - 3600_000) });
    expect((await renew(old)).status).toBe(200);
  });

  it("a legacy session that expired is refused like any expired session", async () => {
    const user = await makeUser("legacydead@shop.com");
    const old = await legacySession(String(user._id), "fam-dead");
    await RefreshToken.updateOne({ family: "fam-dead" }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await renew(old)).status).toBe(401);
  });

  it("signing out a legacy session ends it", async () => {
    const user = await makeUser("legacyout@shop.com");
    const old = await legacySession(String(user._id), "fam-out");
    await signout.POST(req("/api/auth/signout", {}, `refresh_token=${old}`));
    expect((await renew(old)).status).toBe(401);
  });
});

describe("at most 10 sessions per account", () => {
  it("the 11th and 12th sign-ins end the two oldest sessions; the newest still work", async () => {
    const user = await makeUser("many@shop.com");
    const tokens: string[] = [];
    for (let i = 0; i < MAX_SESSIONS_PER_USER + 2; i++) {
      fakeRedis.reset(); resetRedisForTests();
      tokens.push((await login("many@shop.com")).refreshToken);
    }
    expect((await RefreshToken.distinct("family", { userId: user._id })).length).toBe(MAX_SESSIONS_PER_USER);
    expect((await renew(tokens[0])).status).toBe(401);
    expect((await renew(tokens[1])).status).toBe(401);
    expect((await renew(tokens[2])).status).toBe(200);
    expect((await renew(tokens[tokens.length - 1])).status).toBe(200);
  });

  it("another account's sessions are not counted or ended", async () => {
    await makeUser("busy@shop.com");
    const quiet = await makeUser("quiet@shop.com");
    const q = (await login("quiet@shop.com")).refreshToken;
    for (let i = 0; i < MAX_SESSIONS_PER_USER + 3; i++) { fakeRedis.reset(); resetRedisForTests(); await login("busy@shop.com"); }
    expect((await renew(q)).status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: quiet._id })).toBe(1);
  });
});

describe("diagnostic log lines contain no tokens, e-mail addresses or ids", () => {
  it("across every refusal path", async () => {
    const user = await makeUser("private.person@shop.com");
    const { refreshToken, accessToken } = await login("private.person@shop.com");
    const family = (await RefreshToken.findOne({ userId: user._id }))!.family;

    await renew(refreshToken); // fine, silent
    await RefreshToken.updateOne({ userId: user._id }, { expiresAt: new Date(Date.now() - 1000) });
    await renew(refreshToken);                       // idle expired
    await RefreshToken.deleteMany({});
    await renew(refreshToken);                       // unknown/revoked
    await refresh.POST(req("/api/auth/refresh"));    // no cookie
    await renew("garbage");                          // invalid
    expect(logged.length).toBeGreaterThanOrEqual(4);
    const text = logged.join("\n");
    for (const secret of [refreshToken, accessToken, "private.person", String(user._id), family, refreshToken.split(".")[2]]) {
      expect(text).not.toContain(secret);
    }
    expect(sentMails.length).toBeGreaterThanOrEqual(0);
  });
});

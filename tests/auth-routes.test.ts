import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { sentMails, mailState, resetMailer } from "./helpers/mailer";

const hoisted = vi.hoisted(() => ({ afterQueue: [] as (() => unknown)[] }));

vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("nodemailer", async () => (await import("./helpers/mailer")).nodemailerModuleMock());
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => { hoisted.afterQueue.push(task); },
}));

import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import Subscriber from "@/models/subscriber.model";
import { hashToken, signAccessToken, verifyAccessToken } from "@/lib/auth-tokens";
import { setOtp } from "@/lib/otp-store";
import { resetRedisForTests } from "@/lib/redis";
import * as signin from "@/app/api/auth/signin/route";
import * as signup from "@/app/api/auth/signup/route";
import * as verifyOtpRoute from "@/app/api/auth/verify-otp/route";
import * as refresh from "@/app/api/auth/refresh/route";
import * as signout from "@/app/api/auth/signout/route";
import * as requestOtp from "@/app/api/auth/forgot-password/request-otp/route";
import * as reset from "@/app/api/auth/forgot-password/reset/route";
import * as subscribe from "@/app/api/subscribe/route";

setupTestDb();

const post = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const cookieValue = (res: Response, name: string) => {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header?.split(";")[0].slice(name.length + 1) ?? null;
};

async function makeUser(email: string, password = "Old-Passw0rd!") {
  // The model hashes the password itself when saving
  return User.create({ name: "Asha", email, password, isVerified: true });
}

async function session(userId: string, family: string) {
  // A random jti keeps tokens created in the same second distinct
  const raw = jwt.sign({ userId, family, jti: randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d", algorithm: "HS256" });
  await RefreshToken.create({ userId, tokenHash: hashToken(raw), family, expiresAt: new Date(Date.now() + 86_400_000) });
  return raw;
}

beforeEach(() => {
  fakeRedis.reset();
  resetRedisForTests();
  resetMailer();
  hoisted.afterQueue.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

const runAfter = async () => { for (const task of hoisted.afterQueue.splice(0)) await task(); };

describe("roles in tokens", () => {
  it("sign-in and refresh agree: super-admin (any case/whitespace) is 'admin', everyone else 'user'", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "  Boss@Shop.COM ");
    await makeUser("boss@shop.com", "Boss-Passw0rd!");
    await makeUser("shopper@shop.com", "Shop-Passw0rd!");

    for (const [email, password, role] of [
      ["Boss@shop.com", "Boss-Passw0rd!", "admin"],
      ["shopper@shop.com", "Shop-Passw0rd!", "user"],
    ] as const) {
      const res = await signin.POST(post("/api/auth/signin", { email, password }));
      expect(res.status).toBe(200);
      expect((await res.json()).user.role).toBe(role);
      expect(verifyAccessToken(cookieValue(res, "access_token")!).role).toBe(role);

      const refreshed = await refresh.POST(post("/api/auth/refresh", {}, `refresh_token=${cookieValue(res, "refresh_token")}`));
      expect(refreshed.status).toBe(200);
      expect(verifyAccessToken(cookieValue(refreshed, "access_token")!).role).toBe(role); // not "CUSTOMER"/"ADMIN"
    }
  });

  it("a session from before this change (DB role 'CUSTOMER') keeps working through a refresh", async () => {
    const user = await makeUser("old@shop.com");
    const raw = await session(String(user._id), "fam-old");
    const res = await refresh.POST(post("/api/auth/refresh", {}, `refresh_token=${raw}`));
    expect(res.status).toBe(200);
    expect(verifyAccessToken(cookieValue(res, "access_token")!).role).toBe("user");
  });
});

describe("refresh-token rotation under parallel requests (audit N1)", () => {
  const refreshWith = (raw: string) => refresh.POST(post("/api/auth/refresh", {}, `refresh_token=${raw}`));

  it("five parallel refreshes with one cookie: exactly one rotates, nobody is signed out", async () => {
    const user = await makeUser("race@shop.com");
    const raw = await session(String(user._id), "fam-race");

    const results = await Promise.all(Array.from({ length: 5 }, () => refreshWith(raw)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);

    const rotated = results.map((r) => cookieValue(r, "refresh_token")).filter(Boolean) as string[];
    expect(rotated).toHaveLength(1); // one new refresh token; the others only got an access token
    for (const r of results) expect(verifyAccessToken(cookieValue(r, "access_token")!).role).toBe("user");

    // the session is intact: exactly one unused token, and it works
    expect(await RefreshToken.countDocuments({ family: "fam-race", usedAt: { $exists: false } })).toBe(1);
    expect((await refreshWith(rotated[0])).status).toBe(200);
  });

  it("a token used long ago is a replay: 401 and the whole session is wiped", async () => {
    const user = await makeUser("replay@shop.com");
    const uid = String(user._id);
    const raw = await session(uid, "fam-replay");
    const newer = await refreshWith(raw);
    const newToken = cookieValue(newer, "refresh_token")!;
    await RefreshToken.updateOne({ tokenHash: hashToken(raw) }, { usedAt: new Date(Date.now() - 60_000) });

    const replay = await refreshWith(raw);
    expect(replay.status).toBe(401);
    expect(replay.headers.getSetCookie().join(";")).toMatch(/refresh_token=;/);
    expect(await RefreshToken.countDocuments({ family: "fam-replay" })).toBe(0);
    expect((await refreshWith(newToken)).status).toBe(401); // the rotated token died with the session
  });

  it("a well-signed token that is not in the database is a replay too", async () => {
    const user = await makeUser("ghost@shop.com");
    const uid = String(user._id);
    const raw = jwt.sign({ userId: uid, family: "fam-ghost", jti: randomUUID() }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d", algorithm: "HS256" });
    await session(uid, "fam-ghost");
    expect((await refreshWith(raw)).status).toBe(401);
    expect(await RefreshToken.countDocuments({ family: "fam-ghost" })).toBe(0);
  });

  it("sign-in followed at once by a refresh works (tokens are unique even within one second)", async () => {
    await makeUser("fast@shop.com", "Fast-Passw0rd!");
    const login = await signin.POST(post("/api/auth/signin", { email: "fast@shop.com", password: "Fast-Passw0rd!" }));
    const first = cookieValue(login, "refresh_token")!;
    const next = await refreshWith(first);
    expect(next.status).toBe(200);
    expect(cookieValue(next, "refresh_token")).not.toBe(first);
  });
});

describe("sign-up verification (audit N2)", () => {
  const verify = (email: string, otp: string) => verifyOtpRoute.POST(post("/api/auth/verify-otp", { email, otp }));
  const hashed = () => bcrypt.hash("New-Passw0rd!", 4);

  it("creates the account in one write, with the password hash stored exactly once, and signs the user in", async () => {
    await setOtp("signup", "new@shop.com", "123456", "Nina", await hashed());
    const res = await verify("new@shop.com", "123456");
    expect(res.status).toBe(200);
    expect(cookieValue(res, "access_token")).toBeTruthy();

    const user = await User.findOne({ email: "new@shop.com" });
    expect(user).toMatchObject({ name: "Nina", isVerified: true });
    // not hashed twice: the password the user chose still matches
    expect(await user!.comparePassword("New-Passw0rd!")).toBe(true);
    // the code is used up
    expect((await verify("new@shop.com", "123456")).status).toBe(400);
    // and the new account can sign in
    expect((await signin.POST(post("/api/auth/signin", { email: "new@shop.com", password: "New-Passw0rd!" }))).status).toBe(200);
  });

  it("two verifications at the same moment: one account, the other gets 409 (not a 500)", async () => {
    await setOtp("signup", "twin@shop.com", "654321", "Tara", await hashed());
    const [a, b] = await Promise.all([verify("twin@shop.com", "654321"), verify("twin@shop.com", "654321")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await User.countDocuments({ email: "twin@shop.com" })).toBe(1);
    expect(await User.countDocuments({ email: "twin@shop.com", password: { $exists: true } })).toBe(1);
  });

  it("a wrong code creates nothing; a reset code cannot be used to sign up", async () => {
    await setOtp("signup", "wrong@shop.com", "111111", "Wes", await hashed());
    expect((await verify("wrong@shop.com", "222222")).status).toBe(400);
    expect(await User.countDocuments({ email: "wrong@shop.com" })).toBe(0);
    await setOtp("reset", "other@shop.com", "333333");
    expect((await verify("other@shop.com", "333333")).status).toBe(400);
    expect(await User.countDocuments({ email: "other@shop.com" })).toBe(0);
  });
});

describe("sign-out", () => {
  it("clears both cookies and deletes the whole login session, leaving other devices alone", async () => {
    const user = await makeUser("a@shop.com");
    const uid = String(user._id);
    const current = await session(uid, "fam-1");
    await session(uid, "fam-1"); // an earlier rotation of the same session
    await session(uid, "fam-2"); // another device

    const res = await signout.POST(post("/api/auth/signout", {}, `refresh_token=${current}`));
    expect(res.status).toBe(200);
    const cleared = res.headers.getSetCookie().join(";");
    expect(cleared).toMatch(/access_token=;/);
    expect(cleared).toMatch(/refresh_token=;/);
    expect(cleared).toMatch(/Max-Age=0/i);

    expect(await RefreshToken.countDocuments({ family: "fam-1" })).toBe(0);
    expect(await RefreshToken.countDocuments({ family: "fam-2" })).toBe(1);

    // the old cookie can no longer be refreshed
    const again = await refresh.POST(post("/api/auth/refresh", {}, `refresh_token=${current}`));
    expect(again.status).toBe(401);
  });

  it("still clears cookies when the refresh token is missing or garbage", async () => {
    for (const cookie of [undefined, "refresh_token=garbage"]) {
      const res = await signout.POST(post("/api/auth/signout", {}, cookie));
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie().join(";")).toMatch(/refresh_token=;/);
    }
  });
});

describe("password reset", () => {
  it("ends every existing session and signs in with a fresh one", async () => {
    const user = await makeUser("a@shop.com");
    const uid = String(user._id);
    const oldA = await session(uid, "fam-a");
    const oldB = await session(uid, "fam-b");
    const other = await makeUser("b@shop.com");
    await session(String(other._id), "fam-other");
    await setOtp("reset", "a@shop.com", "123456");

    const res = await reset.POST(post("/api/auth/forgot-password/reset", {
      email: "A@Shop.com", otp: "123456", newPassword: "New-Passw0rd!", confirmPassword: "New-Passw0rd!",
    }));
    expect(res.status).toBe(200);

    expect(await RefreshToken.countDocuments({ userId: uid })).toBe(1); // only the new session
    expect(await RefreshToken.countDocuments({ tokenHash: hashToken(oldA) })).toBe(0);
    expect(await RefreshToken.countDocuments({ tokenHash: hashToken(oldB) })).toBe(0);
    expect(await RefreshToken.countDocuments({ family: "fam-other" })).toBe(1); // other users untouched
    expect((await refresh.POST(post("/api/auth/refresh", {}, `refresh_token=${oldA}`))).status).toBe(401);

    const fresh = await User.findById(uid);
    expect(await bcrypt.compare("New-Passw0rd!", fresh!.password!)).toBe(true);
  });

  it("uses the same password rules as sign-up", async () => {
    await makeUser("a@shop.com");
    for (const weak of ["password", "Password1", "Password!", "Sh0rt!"]) {
      await setOtp("reset", "a@shop.com", "123456");
      const res = await reset.POST(post("/api/auth/forgot-password/reset", {
        email: "a@shop.com", otp: "123456", newPassword: weak, confirmPassword: weak,
      }));
      expect(res.status, weak).toBe(400);
    }
  });
});

describe("request-otp does not reveal whether an account exists", () => {
  it("returns the same status and body, and sends mail only when an account exists", async () => {
    await makeUser("exists@shop.com");

    const known = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    const unknown = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "nobody@shop.com" }));
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(Object.fromEntries(unknown.headers)).toEqual(Object.fromEntries(known.headers));

    await runAfter();
    expect(sentMails.map((m) => m.to)).toEqual(["exists@shop.com"]);
    expect(await fakeRedis.get("otp:reset:exists@shop.com")).not.toBeNull();
    expect(await fakeRedis.get("otp:reset:nobody@shop.com")).toBeNull();
  });

  it("a second request while a code is pending looks identical and sends nothing new", async () => {
    await makeUser("exists@shop.com");
    const first = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    await runAfter();
    const second = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    await runAfter();
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(sentMails).toHaveLength(1);
  });

  it("a failing mail server is invisible to the caller and the unsent code is cleared", async () => {
    await makeUser("exists@shop.com");
    mailState.failNext = true;
    const res = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    expect(res.status).toBe(200);
    await runAfter();
    expect(await fakeRedis.get("otp:reset:exists@shop.com")).toBeNull();
  });

  it("the per-address cap answers the same for existing and unknown addresses", async () => {
    await makeUser("exists@shop.com");
    const statuses = async (email: string) => {
      const out: number[] = [];
      for (let i = 0; i < 7; i++) out.push((await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email }))).status);
      return out;
    };
    const known = await statuses("exists@shop.com");
    const unknown = await statuses("nobody@shop.com");
    expect(known).toEqual([200, 200, 200, 200, 200, 429, 429]);
    expect(unknown).toEqual(known);
  });

  it("still rejects an invalid email address", async () => {
    const res = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "not-an-email" }));
    expect(res.status).toBe(400);
  });
});

describe("sign-up OTP e-mails are capped per address", () => {
  it("stops after 5 codes in an hour, without changing the normal messages", async () => {
    const body = { name: "Asha", email: "new@shop.com", password: "Passw0rd!" };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await signup.POST(post("/api/auth/signup", body))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(sentMails).toHaveLength(5);

    await makeUser("taken@shop.com");
    const taken = await signup.POST(post("/api/auth/signup", { ...body, email: "taken@shop.com" }));
    expect(taken.status).toBe(400);
    expect((await taken.json()).error).toBe("User already exists with this email");
  });
});

describe("newsletter", () => {
  it("treats different casing and spacing as the same subscriber", async () => {
    const first = await subscribe.POST(post("/api/subscribe", { email: "Reader@Example.com" }));
    expect(first.status).toBe(201);
    for (const email of ["reader@example.com", "READER@EXAMPLE.COM", "  reader@example.com  "]) {
      const again = await subscribe.POST(post("/api/subscribe", { email }));
      expect(again.status, email).toBe(200);
      expect((await again.json()).message).toBe("You are already subscribed!");
    }
    expect(await Subscriber.countDocuments()).toBe(1);
    expect((await Subscriber.findOne())!.email).toBe("reader@example.com");
  });

  it("parallel requests for one address never produce a 500", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => subscribe.POST(post("/api/subscribe", { email: "race@example.com" }))),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.every((s) => s === 200 || s === 201)).toBe(true);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(await Subscriber.countDocuments()).toBe(1);
  });

  it("rejects invalid addresses", async () => {
    expect((await subscribe.POST(post("/api/subscribe", { email: "nope" }))).status).toBe(400);
  });
});

describe("access token helper still works for withAdmin-style checks", () => {
  it("round trips a role", () => {
    expect(verifyAccessToken(signAccessToken({ userId: "1", email: "a@b.co", role: "admin" })).role).toBe("admin");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";

// The routes with REAL nodemailer talking to a local fake SMTP server (not the nodemailer mock).
const hoisted = vi.hoisted(() => ({ afterQueue: [] as (() => unknown)[] }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => { hoisted.afterQueue.push(task); },
}));

import { User } from "@/models/user.model";
import { resetRedisForTests } from "@/lib/redis";
import { mailTimeouts, resetSmtpTransportForTests as resetMailerForTests } from "@/lib/email/transport";
import * as signup from "@/app/api/auth/signup/route";
import * as requestOtp from "@/app/api/auth/forgot-password/request-otp/route";
import * as signin from "@/app/api/auth/signin/route";
import * as contact from "@/app/api/contact/route";

setupTestDb();

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let logs: string[];
const original = { ...mailTimeouts };

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const runAfter = async () => { for (const task of hoisted.afterQueue.splice(0)) await task(); };

beforeEach(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "u", SMTP_PASS: "p", SMTP_FROM: "noreply@shop.test" });
  Object.assign(mailTimeouts, { connection: 400, greeting: 400, socket: 600, deadline: 1500 });
  resetMailerForTests();
  fakeRedis.reset();
  resetRedisForTests();
  hoisted.afterQueue.length = 0;
  logs = [];
  const grab = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  vi.spyOn(console, "error").mockImplementation(grab);
  vi.spyOn(console, "log").mockImplementation(grab);
  vi.spyOn(console, "warn").mockImplementation(grab);
});
afterEach(async () => {
  Object.assign(mailTimeouts, original);
  resetMailerForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await sink.close();
});

const signupBody = { name: "Asha", email: "new@shop.com", password: "Passw0rd!" };

describe("5. sign-up code flow when the mail server fails", () => {
  for (const mode of ["drop", "no-greeting", "stall-data", "reject-rcpt"] as const) {
    it(`mail server "${mode}": the customer gets an error quickly, the stored code is deleted, nothing sensitive is logged`, async () => {
      sink.state.mode = mode;
      const started = Date.now();
      const res = await signup.POST(post("/api/auth/signup", signupBody));
      expect(Date.now() - started).toBeLessThan(mailTimeouts.deadline + 800);
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Failed to send verification email. Please try again.");
      expect(await fakeRedis.get("otp:signup:new@shop.com")).toBeNull();
      const log = logs.join("\n");
      expect(log).not.toContain("new@shop.com");
      expect(log).not.toMatch(/\b\d{6}\b/);
    });
  }

  it("a working server: 200, one mail to the address with the stored code in it, and the code is never logged", async () => {
    const res = await signup.POST(post("/api/auth/signup", signupBody));
    expect(res.status).toBe(200);
    const stored = (await fakeRedis.get("otp:signup:new@shop.com")) as { otp: string };
    expect(sink.state.messages).toHaveLength(1);
    expect(sink.state.messages[0].raw).toContain(stored.otp);
    expect(logs.join("\n")).not.toContain(stored.otp);
    expect(logs.join("\n")).not.toContain("new@shop.com");
  });

  it("failed sends still count toward the per-address limit (a slow or dead server cannot be used to bypass it)", async () => {
    sink.state.mode = "drop";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await signup.POST(post("/api/auth/signup", signupBody))).status);
    expect(statuses).toEqual([500, 500, 500, 500, 500, 429]);
  });

  it("the mail outage does not block signing in", async () => {
    await User.create({ name: "Asha", email: "member@shop.com", password: "Old-Passw0rd!", isVerified: true });
    sink.state.mode = "drop";
    const res = await signin.POST(post("/api/auth/signin", { email: "member@shop.com", password: "Old-Passw0rd!" }));
    expect(res.status).toBe(200);
  });
});

describe("5. reset code flow", () => {
  it("answers at once while the mail server is hung; when the send fails afterwards the unsent code is removed", async () => {
    await User.create({ name: "Asha", email: "exists@shop.com", password: "Old-Passw0rd!", isVerified: true });
    sink.state.mode = "no-greeting";
    const started = Date.now();
    const res = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    expect(Date.now() - started).toBeLessThan(500); // the send has not run yet: it is queued with after()
    expect(res.status).toBe(200);
    expect(await fakeRedis.get("otp:reset:exists@shop.com")).not.toBeNull();
    await runAfter();
    expect(Date.now() - started).toBeLessThan(mailTimeouts.deadline + 800);
    expect(await fakeRedis.get("otp:reset:exists@shop.com")).toBeNull();
    expect(logs.join("\n")).not.toContain("exists@shop.com");
  });

  it("a delivered reset code is the stored one, and the answer for an unknown address is identical", async () => {
    await User.create({ name: "Asha", email: "exists@shop.com", password: "Old-Passw0rd!", isVerified: true });
    const a = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "exists@shop.com" }));
    const b = await requestOtp.POST(post("/api/auth/forgot-password/request-otp", { email: "nobody@shop.com" }));
    await runAfter();
    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
    expect(sink.state.messages).toHaveLength(1);
    expect(sink.state.messages[0].rcptTo[0]).toContain("exists@shop.com");
  });
});

describe("6. contact form", () => {
  const body = { name: "Asha", email: "asha@cust.test", phone: "", topic: "General", message: "A proper message to the shop", website: "" };
  const okTopic = async () => (await import("@/lib/contact-topics")).CONTACT_TOPICS[0];

  it("sends to the saved/fallback owner address with Reply-To = the customer and From = the shop", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    const res = await contact.POST(post("/api/contact", { ...body, topic: await okTopic() }));
    expect(res.status).toBe(200);
    const m = sink.state.messages[0];
    expect(m.rcptTo[0]).toContain("owner@shop.test");
    const h = headersOf(m.raw);
    expect(h.find((x) => /^reply-to:/i.test(x))).toContain("asha@cust.test");
    expect(h.find((x) => /^from:/i.test(x))).toContain("<noreply@shop.test>");
  });

  it("validation: bad e-mail, short message, unknown topic, name with only spaces are refused and nothing is sent", async () => {
    const topic = await okTopic();
    for (const bad of [{ email: "nope" }, { message: "short" }, { topic: "Hack" }, { name: "  " }, { email: "a@b.co\r\nBcc: x@y.co" }, { message: "x".repeat(2001) }]) {
      const res = await contact.POST(post("/api/contact", { ...body, topic, ...bad }));
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(sink.state.messages).toHaveLength(0);
  });

  it("honeypot: a filled hidden field answers 200 and sends nothing", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    const res = await contact.POST(post("/api/contact", { ...body, topic: await okTopic(), website: "http://spam.test" }));
    expect(res.status).toBe(200);
    expect(sink.state.messages).toHaveLength(0);
  });

  it("mail server down: a clear 502 for the customer, no leak of the cause, quickly", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    sink.state.mode = "stall-ehlo";
    const started = Date.now();
    const res = await contact.POST(post("/api/contact", { ...body, topic: await okTopic() }));
    expect(Date.now() - started).toBeLessThan(mailTimeouts.deadline + 800);
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/couldn't send your message/);
    expect(logs.join("\n")).not.toContain("asha@cust.test");
    expect(logs.join("\n")).not.toContain("A proper message");
  });

  it("a double click (the same message twice) sends one e-mail and answers 200 both times", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    const payload = { ...body, topic: await okTopic() };
    const statuses = (await Promise.all([1, 2, 3].map(() => contact.POST(post("/api/contact", payload))))).map((r) => r.status);
    expect(statuses).toEqual([200, 200, 200]);
    expect(sink.state.messages).toHaveLength(1);
  });

  it("global cap across all senders: 20 an hour, then a friendly 429 and a log line, nothing sent", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    const topic = await okTopic();
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await contact.POST(post("/api/contact", { ...body, topic, email: `sender${i}@cust.test`, message: `Message number ${i} for the shop` }))).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(20);
    expect(statuses.slice(20)).toEqual([429, 429]);
    expect(sink.state.messages).toHaveLength(20);
    const res = await contact.POST(post("/api/contact", { ...body, topic, message: "One more message for the shop" }));
    expect((await res.json()).message).toMatch(/lot of messages right now/);
    expect(logs.join("\n")).toMatch(/\[contact\] global e-mail cap reached \(hour\)/);
  });

  it("global cap per day: 60 a day even when each hour is within its limit", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    const topic = await okTopic();
    await fakeRedis.set("contact_email:day", 60);
    const res = await contact.POST(post("/api/contact", { ...body, topic }));
    expect(res.status).toBe(429);
    expect(logs.join("\n")).toMatch(/cap reached \(day\)/);
  });

  it("outside production with no allowlist the message is held back: the customer sees the normal failure, nothing is sent", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@shop.test");
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await contact.POST(post("/api/contact", { ...body, topic: await okTopic() }));
    expect(res.status).toBe(502);
    expect(sink.state.messages).toHaveLength(0);
  });

  it("no owner address configured: 500 with a plain message, nothing sent", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "");
    vi.stubEnv("SMTP_USER", "");
    const res = await contact.POST(post("/api/contact", { ...body, topic: await okTopic() }));
    expect(res.status).toBe(500);
    expect(sink.state.messages).toHaveLength(0);
  });
});

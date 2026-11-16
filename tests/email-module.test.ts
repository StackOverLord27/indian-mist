import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import { setupTestDb } from "./helpers/mongo";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";
import { EmailLog } from "@/models/email-log.model";
import { sendMail, registerEmailBuilder, resetBuildersForTests, messageIdFor, nextRetryAt, MAX_ATTEMPTS, RETRY_DELAYS_MS } from "@/lib/email";
import { classifyMailError, mailTimeouts, resetSmtpTransportForTests, setTransportForTests } from "@/lib/email/transport";
import { checkRecipient } from "@/lib/email/config";
import { sweepFailedEmails, sweepThrottled, resetSweepThrottleForTests, SWEEP_MIN_GAP_MS } from "@/lib/email/sweep";
import { listFailedEmails, resendEmail } from "@/lib/email/admin";
import type { MailMessage, MailTransport, SendOutcome } from "@/lib/email/types";

// The shared e-mail module (src/lib/email) against the local fake SMTP server and scripted transports.
setupTestDb();

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let logs: string[];
const original = { ...mailTimeouts };
const contactData = { name: "Asha", email: "asha@cust.test", topic: "Order support", message: "A proper message to the shop" };

beforeEach(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "brevo-login-xyz", SMTP_PASS: "s3cr3t-smtp-key", SMTP_FROM: "noreply@shop.test", VERCEL_ENV: "production" });
  delete process.env.EMAIL_ENABLED;
  delete process.env.EMAIL_ALLOWLIST;
  Object.assign(mailTimeouts, { connection: 400, greeting: 400, socket: 600, deadline: 1500 });
  resetSmtpTransportForTests();
  setTransportForTests(null);
  resetBuildersForTests();
  resetSweepThrottleForTests();
  logs = [];
  const grab = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  vi.spyOn(console, "error").mockImplementation(grab);
  vi.spyOn(console, "log").mockImplementation(grab);
  vi.spyOn(console, "warn").mockImplementation(grab);
});
afterEach(async () => {
  Object.assign(mailTimeouts, original);
  setTransportForTests(null);
  resetSmtpTransportForTests();
  vi.restoreAllMocks();
  await sink.close();
});

/** A transport that answers from a script (one entry per call; the last repeats). */
function scripted(...script: SendOutcome[]) {
  const calls: MailMessage[] = [];
  const transport: MailTransport = {
    async send(m) { calls.push(m); return script[Math.min(calls.length - 1, script.length - 1)]; },
  };
  return { transport, calls };
}
const ok: SendOutcome = { ok: true, id: "<x@y>" };
const retryable: SendOutcome = { ok: false, error: { kind: "retryable", code: "421" } };
const permanent: SendOutcome = { ok: false, error: { kind: "permanent", code: "550" } };

describe("exactly once", () => {
  it("40 concurrent sends of the same e-mail produce one message and one log row", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => sendMail("contact", "owner@shop.test", contactData)));
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1);
    expect(results.filter((r) => r.status === "duplicate")).toHaveLength(39);
    expect(sink.state.messages).toHaveLength(1);
    expect(await EmailLog.countDocuments()).toBe(1);
  });

  it("the key is (type, related id): the same related id twice sends once, another id sends again", async () => {
    const { transport, calls } = scripted(ok);
    setTransportForTests(transport);
    await Promise.all([1, 2, 3].map(() => sendMail("contact", "owner@shop.test", contactData, { relatedId: "order-1" })));
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "order-2" });
    expect(calls).toHaveLength(2);
  });

  it("a failed send that nothing will retry gives the claim back: the customer can send the same message again", async () => {
    setTransportForTests(scripted(permanent).transport);
    expect((await sendMail("contact", "owner@shop.test", contactData)).status).toBe("failed");
    setTransportForTests(scripted(ok).transport);
    expect((await sendMail("contact", "owner@shop.test", contactData)).status).toBe("sent");
    expect(await EmailLog.countDocuments()).toBe(1);
  });

  it("a failure the sweep will retry stays claimed (a second caller does not send it in parallel)", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    setTransportForTests(scripted(retryable).transport);
    expect((await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o1" })).status).toBe("failed");
    const again = scripted(ok);
    setTransportForTests(again.transport);
    expect((await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o1" })).status).toBe("duplicate");
    expect(again.calls).toHaveLength(0);
  });

  it("the Message-ID is stable per key and on the sending domain", async () => {
    expect(messageIdFor("contact:abc")).toBe(messageIdFor("contact:abc"));
    expect(messageIdFor("contact:abc")).not.toBe(messageIdFor("contact:abd"));
    expect(messageIdFor("contact:abc")).toMatch(/@shop\.test>$/);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "abc" });
    expect(headersOf(sink.state.messages[0].raw).find((h) => /^message-id:/i.test(h))).toContain(messageIdFor("contact:abc"));
  });
});

describe("retryable and permanent replies", () => {
  it("4xx and network errors are retryable, 5xx and setup errors are permanent", () => {
    for (const code of [421, 450, 451, 452, 454]) expect(classifyMailError({ responseCode: code }).kind, String(code)).toBe("retryable");
    for (const code of [500, 535, 550, 553, 554]) expect(classifyMailError({ responseCode: code }).kind, String(code)).toBe("permanent");
    for (const code of ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET", "EDEADLINE", "EDNS"]) expect(classifyMailError({ code }).kind, code).toBe("retryable");
    for (const code of ["EAUTH", "EENVELOPE", "ERECIPIENT", "EREPLYTO", "ECODE"]) expect(classifyMailError({ code }).kind, code).toBe("permanent");
    expect(classifyMailError({ name: "EnvError", variable: "SMTP_HOST" })).toEqual({ kind: "permanent", code: "ECONFIG:SMTP_HOST" });
  });

  it("real server replies: a 550 is permanent, a dead port is retryable", async () => {
    sink.state.mode = "reject-rcpt";
    expect(await sendMail("contact", "owner@shop.test", contactData, { relatedId: "r1" })).toEqual({ status: "failed", retryable: false, code: "550" });
    await sink.close();
    expect(await sendMail("contact", "owner@shop.test", contactData, { relatedId: "r2" })).toMatchObject({ status: "failed", retryable: true });
  });
});

describe("retry with delays, and giving up", () => {
  const due = (n: number) => Date.now() + n;

  it("retries from the sweep 4 times with growing delays, then marks the failure permanent", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    const s = scripted(retryable);
    setTransportForTests(s.transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o1" });
    let row = (await EmailLog.findOne().lean())!;
    expect([row.status, row.attempts, row.permanent]).toEqual(["failed", 1, false]);
    expect(RETRY_DELAYS_MS.every((d, i) => i === 0 || d > RETRY_DELAYS_MS[i - 1])).toBe(true);

    // not due yet: nothing happens
    expect(await sweepFailedEmails(Date.now())).toBe(0);
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      row = (await EmailLog.findOne().lean())!;
      delays.push(row.nextAttemptAt!.getTime() - Date.now());
      expect(await sweepFailedEmails(row.nextAttemptAt!.getTime() + 1)).toBe(1);
    }
    expect(delays.every((d, i) => i === 0 || d > delays[i - 1])).toBe(true);
    row = (await EmailLog.findOne().lean())!;
    expect(row.attempts).toBe(MAX_ATTEMPTS);
    expect([row.status, row.permanent]).toEqual(["failed", true]);
    expect(row.nextAttemptAt).toBeFalsy();
    expect(s.calls).toHaveLength(MAX_ATTEMPTS);
    expect(await sweepFailedEmails(due(10 * 24 * 3600_000))).toBe(0); // gave up for good
    expect((await listFailedEmails()).permanentFailures).toBe(1);
  });

  it("a retry that works marks the e-mail sent; a permanent error on a retry stops at once", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    setTransportForTests(scripted(retryable, ok).transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o1" });
    await sweepFailedEmails(due(10 * 60_000));
    expect((await EmailLog.findOne().lean())!.status).toBe("sent");

    await EmailLog.deleteMany({});
    setTransportForTests(scripted(retryable, permanent).transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o2" });
    await sweepFailedEmails(due(10 * 60_000));
    expect(await EmailLog.findOne().lean()).toMatchObject({ status: "failed", permanent: true, lastErrorCode: "550" });
  });

  it("two sweeps at once send the retry once", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    setTransportForTests(scripted(retryable).transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "o1" });
    const s = scripted(ok);
    setTransportForTests(s.transport);
    const counts = await Promise.all([sweepFailedEmails(due(10 * 60_000)), sweepFailedEmails(due(10 * 60_000))]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.calls).toHaveLength(1);
  });

  it("a row left in 'queued' by a stopped server is picked up and retried", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    await EmailLog.create({ type: "contact", dedupeKey: "contact:stuck", relatedId: "stuck", status: "queued", attempts: 1 });
    const s = scripted(ok);
    setTransportForTests(s.transport);
    await sweepFailedEmails(due(10 * 60_000));
    expect(s.calls).toHaveLength(1);
    expect((await EmailLog.findOne().lean())!.status).toBe("sent");
  });

  it("the sweep is throttled: once per minute per instance", async () => {
    const t = Date.now();
    expect(await sweepThrottled(t)).toBe(0);
    expect(await sweepThrottled(t + 1000)).toBeNull();
    expect(await sweepThrottled(t + SWEEP_MIN_GAP_MS - 1)).toBeNull();
    expect(await sweepThrottled(t + SWEEP_MIN_GAP_MS)).toBe(0);
  });

  it("a timeout on a hung server is a retryable failure that the sweep retries", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    sink.state.mode = "no-greeting";
    const started = Date.now();
    expect(await sendMail("contact", "owner@shop.test", contactData, { relatedId: "t1" })).toMatchObject({ status: "failed", retryable: true });
    expect(Date.now() - started).toBeLessThan(mailTimeouts.deadline + 800);
    expect((await EmailLog.findOne().lean())!.nextAttemptAt).toBeTruthy();
  });
});

describe("sign-in codes: the time-critical exception", () => {
  it("a retryable error is tried once more at once (2 attempts), then the failure is final", async () => {
    const s = scripted(retryable);
    setTransportForTests(s.transport);
    expect(await sendMail("otp-signup", "a@shop.test", { otp: "123456" })).toEqual({ status: "failed", retryable: true, code: "421" });
    expect(s.calls).toHaveLength(2);
    const row = (await EmailLog.findOne().lean())!;
    expect([row.attempts, row.permanent]).toEqual([2, true]);
    expect(row.nextAttemptAt).toBeFalsy();
  });

  it("a second try that works counts as sent; a permanent error is not tried again", async () => {
    const a = scripted(retryable, ok);
    setTransportForTests(a.transport);
    expect((await sendMail("otp-signup", "a@shop.test", { otp: "123456" })).status).toBe("sent");
    const b = scripted(permanent);
    setTransportForTests(b.transport);
    expect((await sendMail("otp-reset", "b@shop.test", { otp: "654321" })).status).toBe("failed");
    expect(b.calls).toHaveLength(1);
  });

  it("is never retried from the sweep after its code has expired, even with a builder registered and the row due", async () => {
    registerEmailBuilder("otp-signup", async () => ({ to: "a@shop.test", data: { otp: "123456" } }));
    await EmailLog.create({ type: "otp-signup", dedupeKey: "otp-signup:x", relatedId: "x", status: "failed", attempts: 1, permanent: false, nextAttemptAt: new Date(Date.now() - 1000) });
    const s = scripted(ok);
    setTransportForTests(s.transport);
    expect(await sweepFailedEmails(Date.now() + 3600_000)).toBe(0);
    expect(s.calls).toHaveLength(0);
    expect(nextRetryAt("otp-signup", { kind: "retryable", code: "421" }, 1)).toBeNull();
    expect(await resendEmail(String((await EmailLog.findOne().lean())!._id))).toBe("not-resendable");
  });

  it("no code is stored in the log row and no code or address is logged", async () => {
    setTransportForTests(scripted(retryable).transport);
    await sendMail("otp-signup", "secret.person@shop.test", { otp: "246810" });
    const row = JSON.stringify(await EmailLog.findOne().lean());
    expect(row).not.toContain("246810");
    expect(row).not.toContain("secret.person");
    expect(logs.join("\n")).not.toContain("246810");
    expect(logs.join("\n")).not.toContain("secret.person");
  });
});

describe("the guards", () => {
  it("EMAIL_ENABLED=false stops everything: nothing sent, nothing stored", async () => {
    process.env.EMAIL_ENABLED = "false";
    expect(await sendMail("contact", "owner@shop.test", contactData)).toEqual({ status: "dropped", reason: "disabled" });
    expect(await sendMail("otp-signup", "a@shop.test", { otp: "123456" })).toMatchObject({ status: "dropped" });
    expect(sink.state.messages).toHaveLength(0);
    expect(await EmailLog.countDocuments()).toBe(0);
    for (const off of ["0", "off", "no", "FALSE"]) { process.env.EMAIL_ENABLED = off; expect(checkRecipient("a@shop.test").allowed, off).toBe(false); }
    process.env.EMAIL_ENABLED = "true";
    expect(checkRecipient("a@shop.test").allowed).toBe(true);
  });

  for (const env of ["preview", "development", ""]) {
    it(`outside production (VERCEL_ENV="${env}") only the allowlist can be e-mailed`, async () => {
      process.env.VERCEL_ENV = env;
      process.env.EMAIL_ALLOWLIST = "Owner@Shop.test, @team.test";
      expect((await sendMail("contact", "stranger@customer.test", contactData, { relatedId: "1" })).status).toBe("dropped");
      expect((await sendMail("contact", "owner@shop.test", contactData, { relatedId: "2" })).status).toBe("sent"); // exact, any case
      expect((await sendMail("contact", "dev@team.test", contactData, { relatedId: "3" })).status).toBe("sent"); // whole domain
      expect((await sendMail("contact", "dev@team.test.evil.test", contactData, { relatedId: "4" })).status).toBe("dropped");
      expect((await sendMail("contact", "x@evilteam.test", contactData, { relatedId: "5" })).status).toBe("dropped");
      expect(sink.state.messages.map((m) => m.rcptTo[0]).sort()).toEqual(["<dev@team.test>", "<owner@shop.test>"]);
    });
  }

  it("outside production with no allowlist nothing can be sent", async () => {
    process.env.VERCEL_ENV = "preview";
    for (const to of ["a@shop.test", "owner@shop.test"]) expect((await sendMail("otp-signup", to, { otp: "123456" })).status).toBe("dropped");
    expect(sink.state.messages).toHaveLength(0);
    expect(logs.join("\n")).not.toContain("a@shop.test");
  });

  it("in production the allowlist is not consulted", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.EMAIL_ALLOWLIST = "nobody@x.test";
    expect((await sendMail("contact", "anyone@customer.test", contactData)).status).toBe("sent");
  });

  it("a sweep or Resend also respects the guard (the environment may have changed since the first try)", async () => {
    registerEmailBuilder("contact", async () => ({ to: "stranger@customer.test", data: contactData }));
    setTransportForTests(scripted(retryable).transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "g1" });
    process.env.VERCEL_ENV = "preview";
    const s = scripted(ok);
    setTransportForTests(s.transport);
    await sweepFailedEmails(Date.now() + 3600_000);
    expect(s.calls).toHaveLength(0);
    expect(await EmailLog.findOne().lean()).toMatchObject({ status: "failed", permanent: true, lastErrorCode: "EGUARD" });
  });
});

describe("admin: failed e-mails and Resend", () => {
  it("lists the last 7 days only, flags permanent failures of non-code e-mails, and Resend sends once", async () => {
    registerEmailBuilder("contact", async () => ({ to: "owner@shop.test", data: contactData }));
    await EmailLog.create({ type: "contact", dedupeKey: "contact:old", relatedId: "old", status: "failed", permanent: true, attempts: 5, lastErrorCode: "550", createdAt: new Date(Date.now() - 8 * 86400_000) });
    setTransportForTests(scripted(permanent).transport);
    await sendMail("contact", "owner@shop.test", contactData, { relatedId: "new" });
    const list = await listFailedEmails();
    expect(list.emails).toHaveLength(1);
    expect(list.emails[0]).toMatchObject({ type: "contact", permanent: true, lastErrorCode: "550", canResend: true });
    expect(list.permanentFailures).toBe(1);
    expect(JSON.stringify(list)).not.toMatch(/owner@shop|asha@|proper message/);

    const s = scripted(ok);
    setTransportForTests(s.transport);
    const id = list.emails[0].id;
    expect(await resendEmail(id)).toBe("sent-attempted");
    expect(await resendEmail(id)).toBe("not-failed"); // a second click does not send again
    expect(s.calls).toHaveLength(1);
    expect((await listFailedEmails()).emails).toHaveLength(0);
  });

  it("a failed sign-in code is listed but is not a warning and cannot be resent", async () => {
    setTransportForTests(scripted(permanent).transport);
    await sendMail("otp-signup", "a@shop.test", { otp: "123456" });
    const list = await listFailedEmails();
    expect(list.emails).toHaveLength(1);
    expect([list.emails[0].canResend, list.permanentFailures]).toEqual([false, 0]);
  });
});

describe("logs and the log row hold no secrets", () => {
  it("credentials, bodies and recipients never reach the log or the EmailLog row", async () => {
    sink.state.mode = "reject-rcpt";
    await sendMail("contact", "owner.private@shop.test", { ...contactData, message: "PRIVATE-BODY-TEXT" }, { relatedId: "l1" });
    await sink.close();
    await sendMail("contact", "owner.private@shop.test", { ...contactData, message: "PRIVATE-BODY-TEXT" }, { relatedId: "l2" });
    const everything = logs.join("\n") + JSON.stringify(await EmailLog.find().lean());
    for (const secret of ["s3cr3t-smtp-key", "brevo-login-xyz", "owner.private", "asha@cust.test", "PRIVATE-BODY-TEXT"]) expect(everything, secret).not.toContain(secret);
  });

  it("a missing variable is named in the log, its value never", async () => {
    delete process.env.SMTP_HOST;
    resetSmtpTransportForTests();
    expect((await sendMail("contact", "owner@shop.test", contactData)).status).toBe("failed");
    expect(logs.join("\n")).toContain("ECONFIG:SMTP_HOST");
  });
});

describe("test safety rail", () => {
  it("connecting to a mail port on a real host throws instead of connecting", () => {
    for (const [host, port] of [["smtp-relay.brevo.com", 587], ["smtp.gmail.com", 465], ["mail.example.com", 25], ["203.0.113.5", 2525]] as const) {
      expect(() => net.connect(port, host), `${host}:${port}`).toThrow(/Test safety rail/);
    }
  });
});

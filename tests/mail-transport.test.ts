import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";
import { setupTestDb } from "./helpers/mongo";
import { mailTimeouts, resetSmtpTransportForTests as resetMailerForTests } from "@/lib/email/transport";
import { sendMail } from "@/lib/email";
import { getSmtpConfig } from "@/lib/env";

// Real nodemailer talking to a local fake SMTP server (tests/helpers/smtp-sink.ts).

setupTestDb();

const sendOTPVerificationEmail = async (to: string, otp: string) => (await sendMail("otp-signup", to, { otp })).status === "sent";
const sendContactMessageEmail = async ({ to, ...data }: { to: string; name: string; email: string; phone?: string; topic: string; message: string }) =>
  (await sendMail("contact", to, data)).status === "sent";

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
const original = { ...mailTimeouts };
let errors: string[];

beforeEach(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "u", SMTP_PASS: "p", SMTP_FROM: "noreply@shop.test" });
  Object.assign(mailTimeouts, { connection: 400, greeting: 400, socket: 600, deadline: 1500 });
  resetMailerForTests();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a.map(String).join(" ")); });
  vi.spyOn(console, "log").mockImplementation((...a) => { errors.push(a.map(String).join(" ")); });
});
afterEach(async () => {
  Object.assign(mailTimeouts, original);
  resetMailerForTests();
  vi.restoreAllMocks();
  await sink.close();
});

const contact = (over: Partial<Parameters<typeof sendContactMessageEmail>[0]> = {}) =>
  sendContactMessageEmail({ to: "owner@shop.test", name: "Asha", email: "asha@cust.test", topic: "General", message: "Hello there, a message", ...over });

/** The decoded subject and the decoded text/html parts of the one recorded message. */
function decode(raw: string) {
  const unfolded = headersOf(raw);
  const subjectLine = unfolded.find((h) => /^subject:/i.test(h)) ?? "";
  const subject = subjectLine.slice(8).trim().replace(/=\?UTF-8\?([QB])\?([^?]*)\?=\s*/gi, (_m, enc, body) =>
    enc.toUpperCase() === "B"
      ? Buffer.from(body, "base64").toString("utf8")
      : Buffer.from(body.replace(/_/g, " ").replace(/=([0-9A-F]{2})/g, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"),
  );
  const boundary = /boundary="([^"]+)"/.exec(raw)?.[1] ?? "";
  const parts: Record<string, string> = {};
  for (const chunk of raw.split(`--${boundary}`).slice(1)) {
    const [head, ...rest] = chunk.split("\r\n\r\n");
    const type = /Content-Type: text\/(plain|html)/i.exec(head)?.[1]?.toLowerCase();
    if (!type) continue;
    const enc = /Content-Transfer-Encoding: (\S+)/i.exec(head)?.[1].toLowerCase();
    let content = rest.join("\r\n\r\n");
    if (enc === "base64") content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
    else if (enc === "quoted-printable")
      content = Buffer.from(content.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
    parts[type] = content;
  }
  return { headers: unfolded, subject, parts };
}

describe("1. transport configuration", () => {
  it("port 465 uses implicit TLS, 587 and others STARTTLS, and a missing variable is named", () => {
    process.env.SMTP_PORT = "465";
    expect(getSmtpConfig().port).toBe(465);
    process.env.SMTP_PORT = "99999";
    expect(() => getSmtpConfig()).toThrow(/SMTP_PORT/);
    process.env.SMTP_PORT = String(sink.port);
    delete process.env.SMTP_HOST;
    expect(() => getSmtpConfig()).toThrow(/SMTP_HOST/);
  });

  it("SMTP_FROM must be a plain address (a name, brackets or a line break would corrupt the From header)", () => {
    for (const bad of ['Shop <a@b.co>', "a@b.co\r\nBcc: x@y.co", '"Shop" a@b.co', "not-an-address", "a@b.co, c@d.co"]) {
      process.env.SMTP_FROM = bad;
      expect(() => getSmtpConfig(), bad).toThrow(/SMTP_FROM/);
    }
    process.env.SMTP_FROM = "no-reply@shop.test";
    expect(getSmtpConfig().from).toBe("no-reply@shop.test");
  });

  it("a missing variable makes the send return false and the log names the variable, not a value", async () => {
    delete process.env.SMTP_PASS;
    resetMailerForTests();
    expect(await sendOTPVerificationEmail("a@b.co", "123456")).toBe(false);
    expect(errors.join("\n")).toMatch(/SMTP_PASS/);
  });
});

describe("7. the mail server is down, slow or hung: the send ends quickly and returns false", () => {
  const cases: [string, () => void][] = [
    ["no server listening", () => { /* closed below */ }],
    ["connects, never sends the greeting", () => { sink.state.mode = "no-greeting"; }],
    ["greets, never answers EHLO", () => { sink.state.mode = "stall-ehlo"; }],
    ["goes silent after DATA", () => { sink.state.mode = "stall-data"; }],
    ["drops the connection", () => { sink.state.mode = "drop"; }],
  ];
  for (const [name, arrange] of cases) {
    it(`${name}`, async () => {
      arrange();
      if (name === "no server listening") await sink.close();
      const started = Date.now();
      expect(await sendOTPVerificationEmail("customer@cust.test", "654321")).toBe(false);
      expect(await contact()).toBe(false);
      // two sends, each bounded by the deadline (1.5 s here)
      expect(Date.now() - started).toBeLessThan(2 * mailTimeouts.deadline + 800);
      // nothing sensitive in the log
      const log = errors.join("\n");
      expect(log).not.toContain("customer@cust.test");
      expect(log).not.toContain("asha@cust.test");
      expect(log).not.toContain("654321");
      expect(log).not.toContain("Hello there");
    });
  }

  for (const mode of ["no-greeting", "stall-ehlo"] as const) {
    it(`the connection/greeting/socket timeouts alone end a "${mode}" server (hard deadline switched off)`, async () => {
      mailTimeouts.deadline = 60_000;
      resetMailerForTests();
      sink.state.mode = mode;
      const started = Date.now();
      expect(await sendOTPVerificationEmail("a@b.co", "123456")).toBe(false);
      expect(Date.now() - started).toBeLessThan(2500);
      expect(errors.join("\n")).not.toMatch(/EDEADLINE/);
    });
  }

  it("the hard deadline ends a send that the socket timeouts would not (a server that keeps trickling)", async () => {
    mailTimeouts.socket = 60_000; mailTimeouts.greeting = 60_000; mailTimeouts.connection = 60_000;
    resetMailerForTests();
    sink.state.mode = "stall-data";
    const started = Date.now();
    expect(await sendOTPVerificationEmail("a@b.co", "123456")).toBe(false);
    expect(Date.now() - started).toBeLessThan(2 * mailTimeouts.deadline + 800); // a sign-in code is tried twice
    expect(errors.join("\n")).toMatch(/EDEADLINE/);
  });

  it("a server error that echoes the recipient does not put the address in the log", async () => {
    sink.state.mode = "reject-rcpt";
    expect(await sendOTPVerificationEmail("secret.person@cust.test", "123456")).toBe(false);
    expect(errors.join("\n")).not.toContain("secret.person");
    expect(errors.join("\n")).toMatch(/code=550/);
  });

  it("a successful OTP send logs neither the address nor the code", async () => {
    expect(await sendOTPVerificationEmail("asha@cust.test", "246810")).toBe(true);
    const log = errors.join("\n");
    expect(log).not.toContain("246810");
    expect(log).not.toContain("asha@cust.test");
  });
});

describe("3. header injection", () => {
  it("line breaks, NUL and Unicode separators in name or topic never create or alter a header", async () => {
    const evil = "Eve\r\nBcc: evil@x.test\r\nX-Injected: 1\u0000\u2028\u2029\u0085x";
    expect(await contact({ name: evil, topic: "Order\r\nSubject: pwned" })).toBe(true);
    const { headers, subject } = decode(sink.state.messages[0].raw);
    expect(headers.filter((h) => /^(bcc|x-injected|cc):/i.test(h))).toEqual([]);
    expect(headers.filter((h) => /^subject:/i.test(h))).toHaveLength(1);
    expect(subject).not.toMatch(new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]"));
    expect(sink.state.messages[0].rcptTo).toHaveLength(1);
  });

  it("the sender is always SMTP_FROM; the customer's address is only Reply-To", async () => {
    expect(await contact({ email: "asha@cust.test" })).toBe(true);
    expect(await sendOTPVerificationEmail("asha@cust.test", "123456")).toBe(true);
    for (const m of sink.state.messages) {
      expect(m.mailFrom).toContain("noreply@shop.test");
      expect(m.mailFrom).not.toContain("cust.test");
      expect(headersOf(m.raw).find((h) => /^from:/i.test(h))).toContain("<noreply@shop.test>");
    }
    const [c, o] = sink.state.messages.map((m) => headersOf(m.raw));
    expect(c.find((h) => /^reply-to:/i.test(h))).toContain("asha@cust.test");
    expect(o.some((h) => /^reply-to:/i.test(h))).toBe(false);
  });

  it("a reply address that is not a plain address is refused, nothing is sent", async () => {
    for (const email of ['a@b.co\r\nBcc: x@y.co', 'x@y.co, evil@x.test', '"a b"@y.co', "a b@y.co", "Eve <eve@x.test>"]) {
      expect(await contact({ email }), email).toBe(false);
    }
    expect(sink.state.messages).toHaveLength(0);
  });

  it("an OTP recipient that is not a plain address is refused, nothing is sent", async () => {
    for (const to of ["a@b.co, c@d.co", "a@b.co\r\nBcc: x@y.co", "A <a@b.co>"]) expect(await sendOTPVerificationEmail(to, "123456"), to).toBe(false);
    expect(sink.state.messages).toHaveLength(0);
  });

  it("the subject is capped", async () => {
    expect(await contact({ name: "N".repeat(500), topic: "T".repeat(500) })).toBe(true);
    expect(Array.from(decode(sink.state.messages[0].raw).subject).length).toBeLessThanOrEqual(150);
  });
});

describe("4. content", () => {
  it("every user value is HTML-escaped; there is a plain-text part; emoji and Unicode survive", async () => {
    const message = `<script>alert(1)</script> & "quotes" 'single'\nsecond line 😀 नमस्ते`;
    expect(await contact({ name: `<img src=x onerror=alert(1)>Ana 🌿`, topic: "<b>Topic</b>", phone: "<i>1</i>", message })).toBe(true);
    const { parts, subject } = decode(sink.state.messages[0].raw);
    expect(parts.html).toBeDefined();
    expect(parts.plain).toBeDefined();
    expect(parts.html).not.toMatch(/<script|<img src=x|<b>Topic|<i>1/);
    expect(parts.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(parts.html).toContain("&amp;");
    expect(parts.html).toContain("second line 😀 नमस्ते");
    expect(parts.html).toContain("<br/>");
    expect(parts.plain).toContain("<script>alert(1)</script>"); // plain text is not HTML, shown as typed
    expect(parts.plain).toContain("😀 नमस्ते");
    expect(subject).toContain("🌿");
  });

  it("a very long message is cut to 2000 characters, name to 80, in both parts", async () => {
    expect(await contact({ name: "N".repeat(300), message: "m".repeat(9000) + "END" })).toBe(true);
    const { parts } = decode(sink.state.messages[0].raw);
    expect(parts.plain).not.toContain("END");
    expect(parts.plain.match(/m+/g)!.sort((a, b) => b.length - a.length)[0].length).toBe(2000);
    expect(parts.plain).toContain("N".repeat(80));
    expect(parts.plain).not.toContain("N".repeat(81));
  });

  it("truncation never splits an emoji", async () => {
    expect(await contact({ message: "😀".repeat(3000) })).toBe(true);
    const { parts } = decode(sink.state.messages[0].raw);
    expect(parts.plain).not.toContain("�");
    expect(Array.from(parts.plain.slice(parts.plain.indexOf("😀"))).filter((c) => c === "😀")).toHaveLength(2000);
  });

  it("the address printed in the OTP e-mail footer is escaped too", async () => {
    expect(await sendOTPVerificationEmail("o'brien@cust.test", "123456")).toBe(true);
    const { parts } = decode(sink.state.messages[0].raw);
    expect(parts.html).toContain("o&#39;brien@cust.test");
    expect(parts.html).not.toContain("o'brien@cust.test");
    expect(parts.plain).toContain("123456");
  });

  it("the code must be digits (it is not escaped in the HTML, so nothing else may reach it)", async () => {
    expect(await sendOTPVerificationEmail("a@b.co", "<b>x</b>")).toBe(false);
    expect(sink.state.messages).toHaveLength(0);
  });
});

describe("raw socket: the sink really is a server (guards the tests above)", () => {
  it("accepts a connection and greets", async () => {
    const greeting = await new Promise<string>((resolve) => {
      const s = net.connect(sink.port, "127.0.0.1");
      s.once("data", (d) => { resolve(d.toString()); s.destroy(); });
    });
    expect(greeting).toMatch(/^220/);
  });
});

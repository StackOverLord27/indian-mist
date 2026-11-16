import nodemailer, { type SendMailOptions } from "nodemailer";
import { getSmtpConfig } from "@/lib/env";
import type { MailError, MailMessage, MailTransport, SendOutcome } from "./types";

/**
 * Time limits, so a hung or slow mail server cannot keep a serverless function open until the
 * platform kills it (nodemailer's own defaults are 2 minutes to connect, 30 s for the greeting
 * and 10 minutes of silence). `deadline` is a hard cap on the whole send. Mutable only so tests
 * can shorten them.
 */
export const mailTimeouts = { connection: 10_000, greeting: 10_000, socket: 10_000, deadline: 15_000 };

// Created on first use, so building the site never needs mail credentials. A missing SMTP_*
// variable throws an error that names it. No pooling: every serverless instance opens its own
// short-lived connection.
let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "::1";

function getTransporter() {
  if (!cached) {
    const smtp = getSmtpConfig();
    const implicitTls = smtp.port === 465;
    cached = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: implicitTls,
      // Port 587 / 2525: upgrade with STARTTLS and refuse to send the password in clear text when
      // the server does not offer it (a local test server is the only exception).
      requireTLS: !implicitTls && !isLoopback(smtp.host),
      connectionTimeout: mailTimeouts.connection,
      greetingTimeout: mailTimeouts.greeting,
      socketTimeout: mailTimeouts.socket,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }
  return cached;
}

/** Test helper: forget the cached transporter (it is built from the environment on first use). */
export function resetSmtpTransportForTests() {
  cached = null;
}

/**
 * 4xx replies and network trouble can succeed later; 5xx replies, a bad address and a wrong
 * setup (login refused, missing variable) cannot.
 */
export function classifyMailError(error: unknown): MailError {
  const e = (error ?? {}) as { name?: string; code?: unknown; responseCode?: unknown; variable?: string };
  const responseCode = typeof e.responseCode === "number" ? e.responseCode : undefined;
  const code = String(responseCode ?? e.code ?? "UNKNOWN");
  if (responseCode !== undefined) return { kind: responseCode >= 500 ? "permanent" : "retryable", code };
  if (e.name === "EnvError") return { kind: "permanent", code: `ECONFIG:${e.variable}` }; // names the variable, never a value
  if (["EAUTH", "EENVELOPE", "EREPLYTO", "ERECIPIENT", "ECODE", "EMESSAGE"].includes(String(e.code))) return { kind: "permanent", code };
  return { kind: "retryable", code }; // timeouts, resets, DNS, the hard deadline
}

/**
 * Logs why a send failed WITHOUT the address, the code, the message text or any credential:
 * server errors such as "550 5.1.1 <someone@example.com>: Recipient address rejected" carry the
 * recipient, so the error object is never logged as is.
 */
export function logMailError(what: string, error: MailError, extra = "") {
  console.error(`[email] ${what} failed: kind=${error.kind} code=${error.code}${extra}`);
}

export const smtpTransport: MailTransport = {
  async send(message: MailMessage): Promise<SendOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const options: SendMailOptions = {
        from: message.from, // { name, address }: the display name is encoded, never concatenated
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        messageId: message.messageId,
      };
      const send = getTransporter().sendMail(options);
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("mail deadline exceeded"), { code: "EDEADLINE" })), mailTimeouts.deadline);
      });
      send.catch(() => {}); // if the deadline wins, the late result must not become an unhandled rejection
      const info = await Promise.race([send, deadline]);
      return { ok: true, id: String(info.messageId ?? "") };
    } catch (error) {
      return { ok: false, error: classifyMailError(error) };
    } finally {
      clearTimeout(timer);
    }
  },
};

let override: MailTransport | null = null;
export const getTransport = (): MailTransport => override ?? smtpTransport;
/** Test helper: replace (or, with null, restore) the transport. */
export function setTransportForTests(t: MailTransport | null) {
  override = t;
}

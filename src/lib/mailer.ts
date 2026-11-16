import nodemailer, { type SendMailOptions } from "nodemailer";
import { getSmtpConfig } from "@/lib/env";

// The sender's display names. The address itself is SMTP_FROM (see src/lib/env.ts).
const SITE_SENDER_NAME = "Indian Mist";
const CONTACT_SENDER_NAME = "Indian Mist Website";

/**
 * Time limits, so a hung or slow mail server cannot keep a serverless function open until the
 * platform kills it (nodemailer's own defaults are 2 minutes to connect, 30 s for the greeting
 * and 10 minutes of silence). `deadline` is a hard cap on the whole send. Mutable only so tests
 * can shorten them.
 */
export const mailTimeouts = { connection: 8_000, greeting: 8_000, socket: 15_000, deadline: 20_000 };

// Created on first use, so building the site never needs mail credentials. A missing SMTP_*
// variable throws an error that names it, which the senders below log before returning false.
// No pooling: every serverless instance opens its own short-lived connection.
let mailer: { transporter: ReturnType<typeof nodemailer.createTransport>; from: string } | null = null;

/** Test helper: forget the cached transporter (it is built from the environment on first use). */
export function resetMailerForTests() {
  mailer = null;
}

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "::1";

function getMailer() {
  if (!mailer) {
    const smtp = getSmtpConfig();
    const implicitTls = smtp.port === 465;
    mailer = {
      transporter: nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: implicitTls,
        // Port 587 and others: upgrade with STARTTLS and refuse to send the password in clear
        // text when the server does not offer it (a local test server is the only exception).
        requireTLS: !implicitTls && !isLoopback(smtp.host),
        connectionTimeout: mailTimeouts.connection,
        greetingTimeout: mailTimeouts.greeting,
        socketTimeout: mailTimeouts.socket,
        auth: { user: smtp.user, pass: smtp.pass },
      }),
      from: smtp.from,
    };
  }
  return mailer;
}

/** Sends one message; rejects when the server is slow (hard deadline) as well as when it fails. */
async function deliver(message: Omit<SendMailOptions, "from"> & { senderName: string }) {
  const { senderName, ...rest } = message;
  const { transporter, from } = getMailer();
  const send = transporter.sendMail({ ...rest, from: `"${senderName}" <${from}>` });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("mail deadline exceeded"), { code: "EDEADLINE" })), mailTimeouts.deadline);
  });
  // If the deadline wins, the late result of the send must not become an unhandled rejection
  send.catch(() => {});
  try {
    return await Promise.race([send, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Logs why a send failed WITHOUT the address, the code or any message text: server errors such
 * as "550 5.1.1 <someone@example.com>: Recipient address rejected" carry the recipient, so the
 * error object is never logged as is.
 */
function logMailError(what: string, error: unknown) {
  const e = (error ?? {}) as { name?: string; code?: unknown; command?: unknown; responseCode?: unknown; message?: string };
  // Our own configuration errors name a variable and never a value
  const detail = e.name === "EnvError" ? ` ${e.message}` : "";
  console.error(
    `[MAILER] Error sending ${what}: ${e.name ?? "Error"} code=${String(e.code ?? "-")} command=${String(e.command ?? "-")} responseCode=${String(e.responseCode ?? "-")}${detail}`,
  );
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Control characters (CR, LF, NUL, tab...), DEL and the Unicode line/paragraph separators
// have no place in a header value or a name.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
// Same, but a line break is kept (the message body).
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]+/g;

/** Cut to `max` characters, counting an emoji as one (never splits a surrogate pair). */
const truncate = (value: string, max: number) => {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("");
};

/** One-line text for a header or a name: control characters become a space, length capped. */
const singleLine = (value: string, max: number) => truncate(value.replace(CONTROL_CHARS, " ").trim(), max);

/** A plain address only: no whitespace, control characters, quotes, commas or angle brackets. */
const SAFE_ADDRESS = /^[^\s\u0000-\u001f\u007f<>",;()\\]+@[^\s\u0000-\u001f\u007f<>",;()\\]+$/;

export async function sendContactMessageEmail(input: {
  to: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
}) {
  // The route already limits these (80/120/20/2000); the mailer repeats the caps so no other
  // caller can send a huge message or put control characters into a header.
  const fields = {
    name: singleLine(input.name, 80),
    email: singleLine(input.email, 120),
    phone: singleLine(input.phone ?? "", 20),
    topic: singleLine(input.topic, 60),
    message: truncate(input.message.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_KEEP_NEWLINE, " "), 2000),
  };
  const name = escapeHtml(fields.name);
  const email = escapeHtml(fields.email);
  const phone = fields.phone ? escapeHtml(fields.phone) : "—";
  const topic = escapeHtml(fields.topic);
  const message = escapeHtml(fields.message).replace(/\n/g, "<br/>");

  const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#283618;">
  <h2 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 16px;">New enquiry: ${topic}</h2>
  <table cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;margin-bottom:20px;">
    <tr><td style="padding-right:16px;color:#7a7a5a;">Name</td><td>${name}</td></tr>
    <tr><td style="padding-right:16px;color:#7a7a5a;">Email</td><td><a href="mailto:${email}" style="color:#606c38;">${email}</a></td></tr>
    <tr><td style="padding-right:16px;color:#7a7a5a;">Phone</td><td>${phone}</td></tr>
  </table>
  <div style="background:#fdf6e3;border:1px solid #e8dfc8;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;">${message}</div>
  <p style="font-size:12px;color:#9e9e8e;margin-top:20px;">Reply directly to this email to respond to the customer.</p>
</div>`;

  const text = `New enquiry: ${fields.topic}\n\nName: ${fields.name}\nEmail: ${fields.email}\nPhone: ${fields.phone || "—"}\n\n${fields.message}`;

  try {
    // The sender is always the shop's own address (SMTP_FROM). The customer's address is only
    // ever Reply-To, and only when it is a plain address.
    if (!SAFE_ADDRESS.test(fields.email)) throw Object.assign(new Error("unsafe reply address"), { code: "EREPLYTO" });
    await deliver({
      senderName: CONTACT_SENDER_NAME,
      to: input.to,
      replyTo: fields.email,
      subject: singleLine(`[Contact] ${fields.topic} — ${fields.name}`, 150),
      text,
      html,
    });
    return true;
  } catch (error) {
    logMailError("contact message", error);
    return false;
  }
}

/** "asha@example.com" -> "a***@example.com" */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function sendOTPVerificationEmail(email: string, otp: string) {
  const safeEmail = escapeHtml(email);
  // Render OTP as a single styled block
  const digits = `<span style="display:inline-block;padding:12px 24px;text-align:center;letter-spacing:6px;font-size:32px;font-weight:700;font-family:'Georgia',serif;color:#3b4a2f;background:#f7f3e8;border:2px solid #c8b89a;border-radius:8px;">${otp}</span>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email – Indian Mist</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f3e8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3e8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Wordmark header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:#4a5e35;border-radius:50%;text-align:center;line-height:36px;font-size:18px;">
                    🌿
                  </td>
                  <td style="padding-left:10px;font-family:'Georgia',serif;font-size:20px;color:#3b4a2f;letter-spacing:1px;">
                    Indian Mist
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(59,74,47,0.08);">
              <!-- Gradient stripe -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="4" style="background:linear-gradient(90deg,#4a5e35 0%,#b5783a 50%,#7a3b2e 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:44px 48px 40px;">

                <!-- Envelope icon -->
                <tr>
                  <td align="center" style="padding-bottom:20px;font-size:36px;line-height:1;">
                    ✉️
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <h1 style="margin:0;font-family:'Georgia',serif;font-size:26px;font-weight:normal;color:#3b4a2f;">
                      Verify your email
                    </h1>
                  </td>
                </tr>

                <!-- Subtitle -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <p style="margin:0;font-size:14px;color:#7a7a6a;line-height:1.6;max-width:340px;text-align:center;">
                      Use the one-time code below to complete your<br/>Indian Mist registration.
                      This code expires in <strong style="color:#4a5e35;">5 minutes</strong>.
                    </p>
                  </td>
                </tr>

                <!-- OTP box -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <table cellpadding="0" cellspacing="0" style="background:#f7f3e8;border:1px solid #e0d5c0;border-radius:10px;">
                      <tr>
                        <td style="padding:24px 32px;">
                          ${digits}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td height="1" style="background:#e8dfc8;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security note -->
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background:#fdfaf4;border:1px solid #e8dfc8;border-radius:8px;max-width:380px;width:100%;">
                      <tr>
                        <td style="padding:14px 20px;font-size:12px;color:#7a7a6a;line-height:1.7;">
                          🔒&nbsp;&nbsp;If you didn't create an Indian Mist account, you can safely ignore this email. Never share this code with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 8px;font-size:11px;color:#9e9e8e;line-height:1.7;">
              © ${new Date().getFullYear()} Indian Mist. All rights reserved.<br/>
              This email was sent to <a href="mailto:${safeEmail}" style="color:#4a5e35;text-decoration:none;">${safeEmail}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your Indian Mist verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, you can safely ignore this email.`;

  try {
    if (!SAFE_ADDRESS.test(email)) throw Object.assign(new Error("unsafe recipient address"), { code: "ERECIPIENT" });
    if (!/^\d{4,10}$/.test(otp)) throw Object.assign(new Error("code is not numeric"), { code: "ECODE" });
    const info = await deliver({
      senderName: SITE_SENDER_NAME,
      to: email,
      subject: "Your Indian Mist verification code",
      text,
      html,
    });
    // The address is masked: logs are kept by the host and should not collect customers' e-mails
    console.log(`[MAILER] OTP email sent to ${maskEmail(email)}: ${info.messageId}`);
    return true;
  } catch (error) {
    logMailError("OTP email", error);
    return false;
  }
}

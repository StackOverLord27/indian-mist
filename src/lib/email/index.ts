import { after } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { checkRecipient, getFromAddress } from "./config";
import { SAFE_ADDRESS, domainOf, singleLine } from "./sanitize";
import { STATIC_BUILDERS } from "./builders";
import { render } from "./templates";
import { getTransport, logMailError } from "./transport";
import type { EmailData, EmailType, MailError, SendMailResult } from "./types";

export type { EmailType, EmailData, SendMailResult } from "./types";

/**
 * The one entry point for every e-mail the shop sends.
 *
 *   await sendMail("otp-signup", address, { otp })      // customer is waiting for the answer
 *   after(() => sendMail("otp-reset", address, { otp })) // nobody waits: send after the response
 *
 * It NEVER throws: a failing e-mail must not fail the request that asked for it. The result says
 * what happened (sent / duplicate / dropped / failed) and callers that need the outcome (a sign-up
 * code, the contact form) look at it.
 *
 * Exactly once: before sending, a row in the EmailLog collection is claimed under a deduplication
 * key (type + related id) with a UNIQUE index, so two code paths, a retry or a double click cannot
 * send the same e-mail twice. The Message-ID header is stable per key but is NOT relied on for this
 * (SMTP servers may rewrite it).
 */

type TypePolicy = {
  /** A code that is useless once its time is up: retried once at once, never later from the sweep. */
  timeCritical: boolean;
  /** Default related id when the caller gives none (types about an order pass the order id). */
  defaultRelatedId: (to: string, data: unknown) => string;
};

const CONTACT_DOUBLE_CLICK_WINDOW_MS = 10 * 60 * 1000;

const needsRelatedId = (): string => {
  throw new Error("this e-mail needs its related id (the order id)");
};
// Order e-mails: once per order for ever (the order id is the key), whatever the code path or retry.
const orderPolicy: TypePolicy = { timeCritical: false, defaultRelatedId: needsRelatedId };

export const EMAIL_TYPES: Record<EmailType, TypePolicy> = {
  "order-confirmation": orderPolicy,
  "order-shipped": orderPolicy,
  "order-cancelled": orderPolicy,
  "order-refunded": orderPolicy,
  "order-delivered": orderPolicy,
  // The related id is "<user id>.<time>" (see passwordChangedId): every change is its own e-mail.
  "password-changed": orderPolicy,
  // Owner e-mails: the related id says what it is about (order id, "kind:paymentId", day, product + drop)
  "owner-new-order": orderPolicy,
  "owner-payment-alert": orderPolicy,
  "owner-failed-summary": orderPolicy,
  "owner-low-stock": orderPolicy,
  // A sign-in code is one-off: every request is its own e-mail (rate limits sit in the routes).
  "otp-signup": { timeCritical: true, defaultRelatedId: () => randomUUID() },
  "otp-reset": { timeCritical: true, defaultRelatedId: () => randomUUID() },
  // The same enquiry (same sender, topic and text) inside 10 minutes is a double click: one e-mail.
  contact: {
    timeCritical: false,
    defaultRelatedId: (to, data) => {
      const d = data as EmailData["contact"];
      const hash = createHash("sha256").update([to, d.email, d.topic, d.message].join("\u0000")).digest("hex").slice(0, 24);
      return `${hash}-${Math.floor(Date.now() / CONTACT_DOUBLE_CLICK_WINDOW_MS)}`;
    },
  },
};

/** Delays before the 1st..4th retry from the sweep. After the 4th retry a failure is permanent. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
export const MAX_ATTEMPTS = 1 + RETRY_DELAYS_MS.length;

export const dedupeKeyFor = (type: EmailType, relatedId: string) => `${type}:${relatedId}`;

/** A stable Message-ID per (type, related id) on the sending domain. */
export function messageIdFor(key: string): string {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const slug = key.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40);
  return `<${slug}.${hash}@${domainOf(getFromAddress())}>`;
}

const errorLine = (what: string, error: unknown) =>
  console.error(`[email] ${what}: ${error instanceof Error ? error.name : "error"}`);

/** Builds the message, sends it (once more at once for a time-critical code), records the outcome. */
export async function deliverAndRecord(
  logId: unknown | null,
  type: EmailType,
  to: string,
  data: unknown,
  key: string,
  attemptsSoFar: number,
  allowImmediateRetry: boolean,
): Promise<SendMailResult> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getTransport>["send"]>>;
  let attempts = attemptsSoFar;
  try {
    const rendered = render(type, to, data as never);
    if (!SAFE_ADDRESS.test(to)) throw Object.assign(new Error("unsafe recipient address"), { code: "ERECIPIENT" });
    // The customer's address goes into Reply-To only when it is a plain address (no names, lists or line breaks)
    if (rendered.replyTo && !SAFE_ADDRESS.test(rendered.replyTo)) throw Object.assign(new Error("unsafe reply address"), { code: "EREPLYTO" });
    const message = {
      from: { name: singleLine(rendered.senderName, 80), address: getFromAddress() },
      to,
      replyTo: rendered.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      messageId: messageIdFor(key),
    };
    attempts += 1;
    outcome = await getTransport().send(message);
    if (!outcome.ok && outcome.error.kind === "retryable" && allowImmediateRetry) {
      attempts += 1;
      outcome = await getTransport().send(message);
    }
  } catch (error) {
    // Not a transport failure: a bad address or setup found while building the message
    const e = error as { code?: unknown; name?: string };
    const code = e?.name === "EnvError" ? `ECONFIG:${(e as { variable?: string }).variable}` : String(e?.code ?? "EMESSAGE");
    outcome = { ok: false, error: { kind: "permanent", code } };
    attempts = Math.max(attempts, attemptsSoFar + 1);
  }

  if (outcome.ok) {
    await record(logId, { status: "sent", attempts, sentAt: new Date(), permanent: false, lastErrorCode: undefined, nextAttemptAt: undefined });
    console.log(`[email] sent type=${type}`);
    return { status: "sent" };
  }

  const error: MailError = outcome.error;
  const retryAt = nextRetryAt(type, error, attempts);
  logMailError(type, error, ` attempts=${attempts}`);
  await record(logId, {
    status: "failed",
    attempts,
    permanent: retryAt === null,
    lastErrorCode: error.code,
    nextAttemptAt: retryAt ?? undefined,
  });
  return { status: "failed", retryable: error.kind === "retryable", code: error.code };
}

/** When the sweep may try again; null = never (permanent, out of attempts, or a one-off code). */
export function nextRetryAt(type: EmailType, error: MailError, attempts: number, now = Date.now()): Date | null {
  if (error.kind === "permanent" || EMAIL_TYPES[type].timeCritical) return null;
  if (!getBuilder(type)) return null; // nothing to rebuild the message from (the body is never stored)
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(now + RETRY_DELAYS_MS[Math.max(0, attempts - 1)]);
}

async function record(logId: unknown | null, update: Record<string, unknown>) {
  if (!logId) return;
  // undefined means "remove the field" (a success clears the last error and the retry time)
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [k, v] of Object.entries(update)) {
    if (v === undefined) $unset[k] = "";
    else $set[k] = v;
  }
  try {
    await EmailLog.updateOne({ _id: logId }, { $set, ...(Object.keys($unset).length ? { $unset } : {}) });
  } catch (error) {
    errorLine("could not update the e-mail log", error);
  }
}

// ─── Builders: how to rebuild a message from its related id (for retries and Resend) ─────────

export type EmailBuilder<T extends EmailType = EmailType> = (relatedId: string) => Promise<{ to: string; data: EmailData[T] } | null>;
const builders: Partial<Record<EmailType, EmailBuilder>> = {};

/**
 * Types about an order register one: given the order id it returns the recipient and the data
 * again. Without one a failed e-mail cannot be retried or resent (the body is never stored), so
 * today's types (sign-in codes, contact form) are shown to the admin but not retried.
 */
export function registerEmailBuilder<T extends EmailType>(type: T, builder: EmailBuilder<T>) {
  builders[type] = builder as EmailBuilder;
}
export const getBuilder = (type: EmailType): EmailBuilder | undefined => builders[type] ?? (STATIC_BUILDERS[type] as EmailBuilder | undefined);
export const isResendable = (type: EmailType) => !EMAIL_TYPES[type]?.timeCritical && !!getBuilder(type);
export function resetBuildersForTests() {
  for (const k of Object.keys(builders)) delete builders[k as EmailType];
}

export async function sendMail<T extends EmailType>(
  type: T,
  to: string,
  data: EmailData[T],
  opts: { relatedId?: string } = {},
): Promise<SendMailResult> {
  try {
    // 1. Guard: kill switch and (outside production) the allowlist. Nothing is logged but the reason.
    const guard = checkRecipient(to);
    if (!guard.allowed) {
      console.warn(`[email] dropped type=${type}: ${guard.reason === "disabled" ? "EMAIL_ENABLED is off" : "recipient is not in EMAIL_ALLOWLIST (this is not the production deployment)"}`);
      return { status: "dropped", reason: guard.reason };
    }
    const policy = EMAIL_TYPES[type];
    const relatedId = opts.relatedId ?? policy.defaultRelatedId(to, data);
    const key = dedupeKeyFor(type, relatedId);

    // 2. Claim the key. A duplicate-key error means another path already owns this e-mail.
    let logId: unknown | null = null;
    let attemptsSoFar = 0;
    try {
      await dbConnect();
      const row = await EmailLog.create({
        type,
        dedupeKey: key,
        relatedId,
        recipient: isResendable(type) ? to : undefined,
        status: "queued",
        attempts: 0,
      });
      logId = row._id;
    } catch (error) {
      if ((error as { code?: number } | null)?.code === 11000) {
        // The claim is released only when the earlier send failed for good, or failed and nothing
        // will retry it (no builder): then this call may take it over, atomically. A sent or
        // in-progress e-mail, or a failure the sweep will retry, stays claimed.
        const released = await EmailLog.findOneAndUpdate(
          { dedupeKey: key, status: "failed", ...(getBuilder(type) ? { permanent: true } : {}) },
          { $set: { status: "queued" } },
          { returnDocument: "before" },
        ).lean();
        if (!released) {
          console.log(`[email] skipped type=${type}: already claimed`);
          return { status: "duplicate" };
        }
        logId = released._id;
        attemptsSoFar = released.attempts;
      } else {
        // The log database is unavailable: send anyway (a code or an enquiry must not be lost),
        // without the once-only guarantee for this one message.
        errorLine("could not claim the e-mail", error);
      }
    }

    // 3. Send. A time-critical code gets one immediate second try for a retryable error.
    const result = await deliverAndRecord(logId, type, to, data, key, attemptsSoFar, policy.timeCritical);
    scheduleSweep();
    return result;
  } catch (error) {
    errorLine("unexpected error", error);
    return { status: "failed", retryable: false, code: "EUNEXPECTED" };
  }
}

// The sweep lives in sweep.ts; imported lazily here to keep the dependency one-way.
import { sweepThrottled } from "./sweep";

/** After the response, at most once a minute per instance: retry failed e-mails that are due. */
function scheduleSweep() {
  try {
    after(() => sweepThrottled());
  } catch {
    // not inside a request (a script or a test): the admin page and the next request will do it
  }
}

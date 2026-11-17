import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { EMAIL_TYPES, isResendable } from "./index";
import { retryRow } from "./sweep";
import type { EmailType } from "./types";

export const FAILED_WINDOW_DAYS = 7;

export type FailedEmailRow = {
  id: string;
  type: string;
  attempts: number;
  permanent: boolean;
  lastErrorCode: string | null;
  createdAt: string;
  canResend: boolean;
};

/**
 * Failed e-mails of the last 7 days for the admin dashboard. `permanentFailures` is what the
 * warning counts: e-mails that will not be retried any more and that are not one-off sign-in
 * codes (those fail now and then; the customer just asks for another code).
 */
export async function listFailedEmails(now = Date.now()) {
  await dbConnect();
  const since = new Date(now - FAILED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await EmailLog.find({ status: "failed", createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(100).lean();
  const emails: FailedEmailRow[] = rows.map((r) => ({
    id: String(r._id),
    type: r.type,
    attempts: r.attempts,
    permanent: r.permanent,
    lastErrorCode: r.lastErrorCode ?? null,
    createdAt: r.createdAt.toISOString(),
    canResend: isResendable(r.type as EmailType),
  }));
  const permanentFailures = emails.filter((e) => e.permanent && !EMAIL_TYPES[e.type as EmailType]?.timeCritical).length;
  return { emails, permanentFailures };
}

export type ResendResult = "sent-attempted" | "not-found" | "not-failed" | "not-resendable" | "blocked" | "no-source";

/** Sends a failed e-mail again, once, now (the Resend button). The outcome is recorded in the log row. */
export async function resendEmail(id: string): Promise<ResendResult> {
  await dbConnect();
  const row = await EmailLog.findById(id).lean();
  if (!row) return "not-found";
  if (row.status !== "failed") return "not-failed";
  if (!isResendable(row.type as EmailType)) return "not-resendable";
  const ran = await retryRow(row._id, row.type as EmailType, row.relatedId, row.dedupeKey, row.attempts);
  if (ran) return "sent-attempted";
  // Not sent: say why. The guard (kill switch / allowlist) or a missing order or account address
  // marks the row failed for good with its own code; anything else means another click got there first.
  const after = await EmailLog.findById(id).select("lastErrorCode").lean();
  if (after?.lastErrorCode === "EGUARD") return "blocked";
  if (after?.lastErrorCode === "ENOSOURCE") return "no-source";
  return "not-failed";
}

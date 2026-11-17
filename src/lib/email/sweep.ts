import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { checkRecipient } from "./config";
import { EMAIL_TYPES, deliverAndRecord, getBuilder, isResendable, MAX_ATTEMPTS } from "./index";
import { maybeSendFailedSummary } from "./owner-mail";
import type { EmailType } from "./types";

/**
 * Retries failed e-mails without a cron job: a lazy sweep, throttled to once per SWEEP_MIN_GAP_MS
 * per server instance (the same idea as the stock-hold sweep), started after a response by
 * sendMail and by the admin e-mail list. Never throws.
 *
 *  - Only e-mails with a registered builder can be retried (the body is never stored), and never
 *    a time-critical sign-in code: its code has expired by the time the sweep would run.
 *  - Up to 4 retries with increasing delays (1 min, 5 min, 30 min, 2 h); then the failure is
 *    permanent and the admin sees it.
 *  - A row stuck in "queued" (the server stopped mid-send) is treated as a failed attempt.
 */
export const SWEEP_MIN_GAP_MS = 60_000;
const STUCK_QUEUED_MS = 5 * 60_000;
const BATCH = 20;

let lastSweepAt = 0;
export const resetSweepThrottleForTests = () => { lastSweepAt = 0; };

export async function sweepThrottled(now = Date.now()): Promise<number | null> {
  if (now - lastSweepAt < SWEEP_MIN_GAP_MS) return null;
  lastSweepAt = now;
  const retried = await sweepFailedEmails(now);
  await maybeSendFailedSummary(now); // at most one warning a day, only if something failed for good
  return retried;
}

export async function sweepFailedEmails(now = Date.now()): Promise<number> {
  let retried = 0;
  try {
    await dbConnect();
    // A send that never reported back becomes a failed, retryable attempt
    await EmailLog.updateMany(
      { status: "queued", updatedAt: { $lt: new Date(now - STUCK_QUEUED_MS) } },
      { $set: { status: "failed", lastErrorCode: "ESTUCK", nextAttemptAt: new Date(now) } },
    );
    const due = await EmailLog.find({ status: "failed", permanent: false, nextAttemptAt: { $lte: new Date(now) }, attempts: { $lt: MAX_ATTEMPTS } })
      .sort({ nextAttemptAt: 1 })
      .limit(BATCH)
      .lean();
    for (const row of due) {
      const type = row.type as EmailType;
      if (!isResendable(type)) continue; // sign-in codes and types without a builder are never swept
      if (await retryRow(row._id, type, row.relatedId, row.dedupeKey, row.attempts)) retried++;
    }
  } catch (error) {
    console.error(`[email] sweep failed: ${error instanceof Error ? error.name : "error"}`);
  }
  return retried;
}

/** Claims the failed row (failed -> queued, once) and sends again. Used by the sweep and by Resend. */
export async function retryRow(id: unknown, type: EmailType, relatedId: string, key: string, attempts: number): Promise<boolean> {
  if (EMAIL_TYPES[type].timeCritical) return false;
  const builder = getBuilder(type);
  if (!builder) return false;
  const claimed = await EmailLog.findOneAndUpdate({ _id: id, status: "failed" }, { $set: { status: "queued" } }, { returnDocument: "after" }).lean();
  if (!claimed) return false; // another instance (or a click on Resend) got it first
  const built = await builder(relatedId).catch(() => null);
  if (!built) {
    await EmailLog.updateOne({ _id: id }, { $set: { status: "failed", permanent: true, lastErrorCode: "ENOSOURCE" } });
    return false;
  }
  if (!checkRecipient(built.to).allowed) {
    await EmailLog.updateOne({ _id: id }, { $set: { status: "failed", permanent: true, lastErrorCode: "EGUARD" } });
    return false;
  }
  await deliverAndRecord(id, type, built.to, built.data, key, attempts, false);
  return true;
}

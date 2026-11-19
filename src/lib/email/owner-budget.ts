import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { getEmailDailyLimit } from "@/lib/env";
import type { OwnerEmailType } from "./types";

/**
 * Keeps the owner's alert volume bounded, and keeps the mail plan's daily allowance (Brevo free
 * plan: 300 a day, shared with the customers' e-mails and sign-in codes) for what matters most.
 *
 *  - Hourly caps per kind, so a burst (a sale, a webhook storm, a stuck loop) cannot flood the
 *    inbox or burn the allowance. A capped alert is NOT sent and NOT retried; it is logged (once
 *    an hour per kind). Everything an alert reports is also on the admin dashboard.
 *  - Priority: payment problems (urgent, the money is at stake) and the failed-e-mail warning may
 *    use the allowance up to 95%; the new-order and low-stock alerts stop at 70%, so when the
 *    allowance is getting used up the urgent ones still get through.
 *  - Counted from the EmailLog (one row per e-mail, any recipient), over the last hour / 24 hours.
 *    A retry is not a new e-mail and is not capped.
 */
export const OWNER_HOURLY_CAP: Record<OwnerEmailType, number> = {
  "owner-new-order": 10,
  "owner-payment-alert": 30,
  "owner-failed-summary": 2,
  "owner-low-stock": 10,
};
const URGENT: ReadonlySet<OwnerEmailType> = new Set(["owner-payment-alert", "owner-failed-summary"]);
export const URGENT_DAILY_SHARE = 0.95;
export const NORMAL_DAILY_SHARE = 0.7;

export type Allowance = { ok: true } | { ok: false; reason: "hourly" | "daily-near-limit" };

const loggedAt = new Map<string, number>();
export const resetCapLogsForTests = () => loggedAt.clear();

export async function ownerAllowance(type: OwnerEmailType, now = Date.now()): Promise<Allowance> {
  await dbConnect();
  const hour = await EmailLog.countDocuments({ type, createdAt: { $gte: new Date(now - 3600_000) } });
  if (hour >= OWNER_HOURLY_CAP[type]) return capped(type, "hourly", now);
  const today = await EmailLog.countDocuments({ createdAt: { $gte: new Date(now - 24 * 3600_000) }, status: { $in: ["sent", "queued"] } });
  const share = URGENT.has(type) ? URGENT_DAILY_SHARE : NORMAL_DAILY_SHARE;
  if (today >= Math.floor(getEmailDailyLimit() * share)) return capped(type, "daily-near-limit", now);
  return { ok: true };
}

function capped(type: OwnerEmailType, reason: "hourly" | "daily-near-limit", now: number): Allowance {
  const key = `${type}:${reason}`;
  if (now - (loggedAt.get(key) ?? 0) > 3600_000) {
    loggedAt.set(key, now);
    console.warn(`[email] owner alert capped type=${type} reason=${reason} (not sent; see the admin dashboard)`);
  }
  return { ok: false, reason };
}

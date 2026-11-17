import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { Order } from "@/models/order.model";
import { getEmailPolicy } from "@/lib/env";
import { dedupeKeyFor } from "./index";
import { sendOrderEmail } from "./order-mail";
import { sendOwnerEmail } from "./owner-mail";

/**
 * Closes the crash gap: a paid order is saved first and its e-mails are queued afterwards, so a
 * server stopping between the two leaves a paid order with no e-mail row at all (nothing for the
 * retry sweep to find). This lazy, throttled pass (run by the same sweep, never on every request)
 * finds paid orders of the last 7 days with no order-confirmation row and queues the e-mail through
 * the normal path, so the once-only key still applies.
 *
 *  - Never touches an order that already has a row (sent, failed or queued): retries are the
 *    sweep's job, and a "sent" row is never repeated.
 *  - Never touches orders older than the window or younger than a short grace (their own e-mails
 *    are still being queued), and skips cancelled orders.
 *  - The owner's new-order alert is repaired only for an order that ALSO lacks its confirmation
 *    row: that is the crash signature. An alert that was deliberately capped (volume rules) has
 *    its confirmation row, so it is never brought back.
 *  - Does nothing when e-mail is switched off, or outside production with no allowlist; each
 *    message still goes through the normal recipient guard.
 */
export const REPAIR_WINDOW_MS = 7 * 24 * 3600_000;
export const REPAIR_GRACE_MS = 2 * 60_000;
export const REPAIR_MIN_GAP_MS = 10 * 60_000;
const BATCH = 50;

let lastRepairAt = 0;
export const resetRepairThrottleForTests = () => { lastRepairAt = 0; };

export async function repairMissingOrderEmailsThrottled(now = Date.now()): Promise<number | null> {
  if (now - lastRepairAt < REPAIR_MIN_GAP_MS) return null;
  lastRepairAt = now;
  return repairMissingOrderEmails(now);
}

/** Returns how many orders were repaired. Never throws. */
export async function repairMissingOrderEmails(now = Date.now()): Promise<number> {
  try {
    const policy = getEmailPolicy();
    if (!policy.enabled || (!policy.production && policy.allowlist.length === 0)) return 0;
    await dbConnect();
    const orders = await Order.find({
      paymentStatus: "PAID",
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: new Date(now - REPAIR_WINDOW_MS), $lte: new Date(now - REPAIR_GRACE_MS) },
    }).select("_id").sort({ createdAt: -1 }).limit(BATCH * 4).lean();
    if (!orders.length) return 0;
    const ids = orders.map((o) => String(o._id));
    const have = new Set(
      (await EmailLog.find({ dedupeKey: { $in: ids.map((id) => dedupeKeyFor("order-confirmation", id)) } }).select("relatedId").lean()).map((r) => r.relatedId),
    );
    const missing = ids.filter((id) => !have.has(id)).slice(0, BATCH);
    for (const id of missing) {
      console.warn(`[email] repairing the missing e-mails of a paid order (crash gap) order=${id}`);
      await sendOrderEmail("order-confirmation", id);
      await sendOwnerEmail("owner-new-order", id);
    }
    return missing.length;
  } catch (error) {
    console.error(`[email] repair pass failed: ${error instanceof Error ? error.name : "error"}`);
    return 0;
  }
}

import dbConnect from "@/lib/db";
import { EmailLog } from "@/models/email-log.model";
import { Order } from "@/models/order.model";
import { claimLowStock } from "@/lib/low-stock";
import { dedupeKeyFor, EMAIL_TYPES, getBuilder, sendMail } from "./index";
import { afterResponse } from "./order-mail";
import { ownerAllowance } from "./owner-budget";
import { lowStockId, paymentAlertId, SAFE_PAYMENT_ID, summaryDay } from "./owner-data";
import type { EmailType, OwnerEmailType, PaymentAlertKind, SendMailResult } from "./types";

/**
 * How the rest of the app e-mails the shop owner. The same rules as the customer's e-mails (sent
 * after the database change, after the response, never throws, exactly once through the dedupe
 * key), plus the owner-alert volume rules in owner-budget.ts (hourly caps, and priority for payment
 * problems when the day's allowance is nearly used). An alert never blocks or fails the flow that
 * raised it.
 */

/** Builds the owner's e-mail from the database and sends it. The result is for tests and logs. */
export async function sendOwnerEmail(type: OwnerEmailType, relatedId: string): Promise<SendMailResult> {
  try {
    await dbConnect();
    // A repeat (a second webhook, a double click) is answered before anything is counted or capped
    if (await EmailLog.exists({ dedupeKey: dedupeKeyFor(type, relatedId) , status: { $ne: "failed" } })) return { status: "duplicate" };
    const allowance = await ownerAllowance(type);
    if (!allowance.ok) return { status: "capped", reason: allowance.reason };
    const builder = getBuilder(type);
    const built = builder ? await builder(relatedId) : null;
    if (!built) {
      console.warn(`[email] not sent type=${type}: nothing to report or no owner address (Admin > Contact Page, SUPER_ADMIN_EMAIL)`);
      return { status: "failed", retryable: false, code: "ENOSOURCE" };
    }
    return await sendMail(type, built.to, built.data as never, { relatedId });
  } catch (error) {
    console.error(`[email] could not prepare type=${type}: ${error instanceof Error ? error.name : "error"}`);
    return { status: "failed", retryable: false, code: "EUNEXPECTED" };
  }
}

const queueOwner = (type: OwnerEmailType, relatedId: string) => afterResponse(() => sendOwnerEmail(type, relatedId));

/** 1. A new paid order. Only the path that created the order asks (finalizeOrder). */
export const queueNewOrderAlert = (orderId: unknown) => queueOwner("owner-new-order", String(orderId));

/** 2. A payment problem. One alert per (kind, Razorpay payment id): repeated webhooks do not repeat it. */
export function queuePaymentAlert(kind: PaymentAlertKind, paymentId: string | undefined) {
  if (!paymentId || !SAFE_PAYMENT_ID.test(paymentId)) {
    console.error(`[email] payment alert not sent (${kind}): the payment id is missing or not a Razorpay id`);
    return Promise.resolve();
  }
  return queueOwner("owner-payment-alert", paymentAlertId(kind, paymentId));
}

/**
 * An order that was flagged "needs review" (an amount that does not match, a promo code used
 * beyond its limit, stock that ran short, a possible duplicate) or that shares its payment with
 * another order. Looked at after the response, when every note has been written.
 */
export const queueReviewAlert = (orderId: unknown) =>
  afterResponse(async () => {
    await dbConnect();
    const order = await Order.findById(orderId).select("reviewNote razorpayPaymentId").lean();
    if (!order?.razorpayPaymentId) return;
    const twin = await Order.exists({ razorpayPaymentId: order.razorpayPaymentId, _id: { $ne: order._id } });
    if (!twin && !order.reviewNote) return; // nothing to review
    await sendOwnerEmail("owner-payment-alert", paymentAlertId(twin ? "duplicate-payment" : "order-in-review", order.razorpayPaymentId));
  });

/** 6. Low stock (only when the admin switched it on): once per drop, per product. */
export const queueLowStockCheck = (productIds: unknown[]) =>
  afterResponse(async () => {
    for (const { productId, at } of await claimLowStock(productIds)) await sendOwnerEmail("owner-low-stock", lowStockId(productId, at));
  });

/**
 * 4. If any e-mail has failed for good since the last warning, ONE warning per day at most.
 * Sign-in codes are left out (they fail now and then and the customer just asks again), and so is
 * this warning itself. Run from the lazy sweep. The failures it reports are marked with the day,
 * so each is reported once; if the warning could not be sent they are un-marked for tomorrow.
 */
export async function maybeSendFailedSummary(now = Date.now()): Promise<void> {
  try {
    await dbConnect();
    const date = summaryDay(now);
    if (await EmailLog.exists({ dedupeKey: dedupeKeyFor("owner-failed-summary", date) })) return; // already today
    const skip = (Object.keys(EMAIL_TYPES) as EmailType[]).filter((t) => EMAIL_TYPES[t].timeCritical).concat("owner-failed-summary");
    const rows = await EmailLog.find({
      status: "failed", permanent: true, summaryDate: { $exists: false }, type: { $nin: skip },
      createdAt: { $gte: new Date(now - 7 * 24 * 3600_000) },
    }).select("_id").limit(500).lean();
    if (!rows.length) return;
    const ids = rows.map((r) => r._id);
    await EmailLog.updateMany({ _id: { $in: ids }, summaryDate: { $exists: false } }, { $set: { summaryDate: date } });
    const result = await sendOwnerEmail("owner-failed-summary", date);
    if (result.status !== "sent" && result.status !== "duplicate" && !(result.status === "failed" && result.retryable)) {
      await EmailLog.updateMany({ _id: { $in: ids }, summaryDate: date }, { $unset: { summaryDate: "" } }); // try again tomorrow
    }
  } catch (error) {
    console.error(`[email] failed-e-mail warning could not run: ${error instanceof Error ? error.name : "error"}`);
  }
}

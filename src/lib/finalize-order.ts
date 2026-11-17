import type { HydratedDocument } from "mongoose";
import { Order, type IOrder } from "@/models/order.model";
import { settleOrderStock, consumeHold } from "@/lib/stock-reservation";
import { addReviewNote } from "@/lib/review-note";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";
import { requireRedis } from "@/lib/redis";
import { findPromo, countPaidPromoUses } from "@/lib/promo";
import Settings from "@/models/settings.model";
import type { SiteSettings } from "@/types/admin";
import { revalidateCatalog } from "@/lib/revalidate-storefront";
import { orderIdForRazorpayOrder } from "@/lib/order-id";
import { samePaymentText } from "@/lib/duplicate-note";
import { orderNumber } from "@/lib/order-number";
import { queueOrderEmail } from "@/lib/email/order-mail";
import { queueLowStockCheck, queueNewOrderAlert, queuePaymentAlert, queueReviewAlert } from "@/lib/email/owner-mail";

type PendingOrder = Record<string, unknown> & {
  userId: string;
  promoCode?: string | null;
};

type FinalizeResult =
  | { ok: true; order: HydratedDocument<IOrder>; alreadyProcessed: boolean }
  | { ok: false; status: number; message: string };

/**
 * A promo code used beyond its limit (two checkouts opened at once can both pass the limit check)
 * is saved on the order as a note for the shop. The customer has paid, so the order always stands.
 * (The stock note is saved by settleOrderStock itself.)
 */
async function recordPromoReviewNote(order: HydratedDocument<IOrder>) {
  try {
    if (!order.promoCode) return;
    const settings = await Settings.findOne().lean<SiteSettings>();
    const promo = findPromo(settings?.pricingSettings?.promoCodes, order.promoCode);
    if (!promo) return;

    // Other PAID orders only: this order itself does not count against its own code
    const others = { excludeOrderId: order._id };
    const maxPerUser = promo.maxUsesPerUser ?? 1;
    const reasons: string[] = [];

    if (maxPerUser > 0 && (await countPaidPromoUses(order.promoCode, { ...others, userId: String(order.userId) })) >= maxPerUser) {
      reasons.push(`this customer already used it ${maxPerUser} time(s)`);
    }
    if (promo.maxUses && promo.maxUses > 0 && (await countPaidPromoUses(order.promoCode, others)) >= promo.maxUses) {
      reasons.push(`it passed its total limit of ${promo.maxUses} uses`);
    }
    if (reasons.length) {
      await addReviewNote(order._id, `Promo code ${order.promoCode} was used beyond its limit: ${reasons.join(" and ")}.`);
    }
  } catch (error) {
    // The customer has paid; losing the note must not fail the order
    console.error("[finalizeOrder] promo review check failed:", error);
  }
}

/**
 * When the payment event says how much was paid, it must match the order total. A mismatch is
 * never a reason to fail the order (the customer has paid): it adds a note for the shop.
 */
async function checkPaidAmount(order: HydratedDocument<IOrder>, paidAmountPaise: number | undefined) {
  if (typeof paidAmountPaise !== "number" || !Number.isFinite(paidAmountPaise)) return;
  const expected = Math.round(order.totalAmount * 100);
  if (paidAmountPaise === expected) return;
  try {
    await addReviewNote(
      order._id,
      `Amount mismatch: Razorpay reports ₹${(paidAmountPaise / 100).toFixed(2)} paid, the order total is ₹${(expected / 100).toFixed(2)}. Check the payment in Razorpay before shipping.`,
    );
  } catch (error) {
    console.error("[finalizeOrder] saving the amount note failed:", error);
  }
}

/** Two paid orders from one account with the same items closer together than this are flagged. */
export const DUPLICATE_WINDOW_MINUTES = 30;

const lineSignature = (items: { productId?: unknown; selectedSize?: string; selectedColor?: string; quantity: number }[]) =>
  items.map((i) => `${String(i.productId)}|${i.selectedSize ?? ""}|${i.selectedColor ?? ""}|${i.quantity}`).sort().join(",");

/**
 * The same account paying twice for the same things within 30 minutes (a double click, a retry
 * after a slow page) is probably a mistake. The new order stands (the customer has paid), but it
 * gets a note so the shop can check before shipping and refund one of the two. Cancelled orders
 * do not count. Never a reason to fail the order.
 */
async function flagPossibleDuplicate(order: HydratedDocument<IOrder>) {
  try {
    // The SAME payment recorded twice is not a second purchase: say so plainly. (New orders
    // cannot be doubled any more, see orderIdForRazorpayOrder; this covers older duplicates.)
    if (order.razorpayPaymentId) {
      const samePayment = await Order.find({ razorpayPaymentId: order.razorpayPaymentId, _id: { $ne: order._id } }).select("_id").lean();
      if (samePayment.length) {
        await addReviewNote(order._id, samePaymentText(samePayment.map((o) => o._id)));
        return;
      }
    }
    const since = new Date(order.createdAt.getTime() - DUPLICATE_WINDOW_MINUTES * 60_000);
    const recent = await Order.find({
      userId: order.userId,
      _id: { $ne: order._id },
      paymentStatus: "PAID",
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: since, $lte: order.createdAt },
    })
      .select("items.productId items.selectedSize items.selectedColor items.quantity")
      .lean();
    const mine = lineSignature(order.items);
    const twin = recent.find((o) => lineSignature(o.items) === mine);
    if (!twin) return;
    await addReviewNote(
      order._id,
      `Possible duplicate payment: the same account paid for the same items in order ${orderNumber(twin._id)} less than ${DUPLICATE_WINDOW_MINUTES} minutes earlier. Check with the customer before shipping both; refund one in Razorpay if it is a mistake.`,
    );
  } catch (error) {
    console.error("[finalizeOrder] duplicate check failed:", error);
  }
}

/** The payment is now an order: any record of it as "unmatched" is resolved. */
async function resolveUnmatched(razorpayOrderId: string, orderId: unknown) {
  try {
    await UnmatchedPayment.updateOne(
      { razorpayOrderId, resolvedAt: { $exists: false } },
      { $set: { resolvedAt: new Date(), resolvedOrderId: orderId } },
    );
  } catch (error) {
    console.error("[finalizeOrder] resolving the unmatched payment failed:", error);
  }
}

/**
 * Turns a paid Razorpay order into a real order, exactly once.
 * Safe to call from both the browser confirmation and the Razorpay webhook.
 */
export async function finalizeOrder(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  userId?: string;
  /** Where the confirmation came from (saved with an unmatched payment) */
  source?: "webhook" | "verify-payment";
  /** The amount the payment event reports, in paise (the webhook carries it) */
  paidAmountPaise?: number;
}): Promise<FinalizeResult> {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, paidAmountPaise } = opts;
  const source = opts.source ?? "verify-payment";

  // The order may already exist (the other path got there first, or this is a repeat). Everything
  // that follows for an existing order is the same whenever it is found, so it is one function.
  const resolveExisting = async (existing: HydratedDocument<IOrder>): Promise<FinalizeResult> => {
    if (userId && String(existing.userId) !== userId) {
      return { ok: false, status: 403, message: "This order belongs to another account" };
    }
    // The order exists. If an earlier run stopped before settling its stock, finish that now
    // (safe to repeat, and a no-op when there is nothing left to do).
    try {
      if (existing.stockSettled === false) await settleOrderStock(existing._id);
      else await consumeHold(razorpayOrderId);
    } catch (error) {
      console.error("[finalizeOrder] settling the stock of an earlier run failed:", error);
    }
    await checkPaidAmount(existing, paidAmountPaise);
    await resolveUnmatched(razorpayOrderId, existing._id);
    // A late event may have added a note (an amount that does not match): the owner hears of it once
    await queueReviewAlert(existing._id);
    return { ok: true, order: existing, alreadyProcessed: true };
  };

  const existing = await Order.findOne({ razorpayOrderId });
  if (existing) return resolveExisting(existing);

  const redis = requireRedis();

  const key = `pending_order_${razorpayOrderId}`;
  const raw = await redis.get(key);
  if (!raw) {
    // The other path may have created the order and removed the pending copy between our first
    // look and this one (the browser confirmation and the webhook arrive together). That is not a
    // lost payment: look again before calling it one.
    const created = await Order.findOne({ razorpayOrderId });
    if (created) return resolveExisting(created);

    // A paid-but-no-order case: nothing can be rebuilt. Save it where the admin dashboard shows it
    // (the log line is only a backup).
    console.error(`[finalizeOrder] payment ${razorpayPaymentId} for ${razorpayOrderId}: pending order not found`);
    try {
      await UnmatchedPayment.updateOne(
        { razorpayOrderId },
        {
          $setOnInsert: {
            razorpayPaymentId,
            source,
            ...(typeof paidAmountPaise === "number" && { amount: paidAmountPaise / 100 }),
          },
          $inc: { seen: 1 },
        },
        { upsert: true },
      );
    } catch (error) {
      // Not recorded: answer with a server error so the webhook is retried (nothing else keeps this payment visible)
      console.error("[finalizeOrder] saving the unmatched payment failed:", error);
      return { ok: false, status: 500, message: "Order session expired or not found. If you were charged, contact support." };
    }
    // Saved: URGENT e-mail to the owner, once per payment (a webhook retry does not repeat it)
    await queuePaymentAlert("payment-without-order", razorpayPaymentId);
    return {
      ok: false,
      status: 404,
      message: "Order session expired or not found. If you were charged, contact support.",
    };
  }

  const pending = (typeof raw === "string" ? JSON.parse(raw) : raw) as PendingOrder;
  if (userId && String(pending.userId) !== userId) {
    return { ok: false, status: 403, message: "This order belongs to another account" };
  }

  // The pending order is NOT deleted before the order exists. Exactly-once comes from the order's
  // own database id: every attempt for this Razorpay order uses the same `_id`
  // (orderIdForRazorpayOrder), so when the browser and the webhook arrive together the database lets
  // ONE create in and answers the other with a duplicate-key error, whether or not the unique
  // razorpayOrderId index exists. The loser returns the winner's order. If this process dies before
  // the order is saved, the pending order is still there for the webhook's retry (deleting it first
  // would lose a paid order).
  let order: HydratedDocument<IOrder>;
  const finalizedAt = new Date();
  try {
    order = await Order.create({
      ...pending,
      _id: orderIdForRazorpayOrder(razorpayOrderId),
      promoCode: pending.promoCode ?? undefined,
      status: "PROCESSING",
      paymentStatus: "PAID",
      stockSettled: false, // set by settleOrderStock; a repair pass finishes it if the process stops first
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      finalizedVia: source,
      finalizedAt,
    });
  } catch (error) {
    if ((error as { code?: number } | null)?.code === 11000) {
      const dup = await Order.findOne({ $or: [{ _id: orderIdForRazorpayOrder(razorpayOrderId) }, { razorpayOrderId }] });
      if (dup) {
        // The other request is settling it; if that request died, the repair pass will
        console.warn(`[order] ${source} confirmation for ${razorpayOrderId} found the order already created via ${dup.finalizedVia ?? "unknown"} at ${dup.finalizedAt?.toISOString() ?? "unknown time"}`);
        return { ok: true, order: dup, alreadyProcessed: true };
      }
    }
    throw error; // the pending order is untouched, so a retry can still complete it
  }
  console.log(`[order] created ${orderNumber(order._id)} for ${razorpayOrderId} (payment ${razorpayPaymentId}) via ${source} at ${finalizedAt.toISOString()}`);

  try {
    await settleOrderStock(order._id);
  } catch (error) {
    // The customer has already paid, so never fail the order over a stock update.
    // The order stays stockSettled: false and the repair pass settles it.
    console.error("[finalizeOrder] stock settle failed:", error);
  }
  // Stock and "Sold Out" badges changed: refresh the product pages. The customer has paid, so a
  // problem here must never fail the order.
  try {
    revalidateCatalog();
  } catch (error) {
    console.error("[finalizeOrder] revalidation failed:", error);
  }
  await recordPromoReviewNote(order);
  await checkPaidAmount(order, paidAmountPaise);
  await flagPossibleDuplicate(order);
  await resolveUnmatched(razorpayOrderId, order._id);

  // The order is saved: the pending copy is no longer needed. A leftover one only expires later.
  try {
    await redis.del(key);
  } catch (error) {
    console.error("[finalizeOrder] removing the pending order failed:", error);
  }

  // The confirmation e-mail. Only the path that really CREATED the order gets here (the one that
  // lost the race returned above), and the order id is the e-mail's own once-only key as well.
  // Sent after the response; never throws, so a mail problem cannot undo or fail the order.
  await queueOrderEmail("order-confirmation", order._id);
  // The owner: the new order, anything that needs review (every note has been written by now),
  // and (only if switched on) a product that has fallen to its low-stock level
  await queueNewOrderAlert(order._id);
  await queueReviewAlert(order._id);
  await queueLowStockCheck(order.items.map((i) => i.productId));

  return { ok: true, order, alreadyProcessed: false };
}

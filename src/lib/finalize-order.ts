import type { HydratedDocument } from "mongoose";
import { Order, type IOrder } from "@/models/order.model";
import { settleStockForPaidOrder } from "@/lib/stock-reservation";
import Settings from "@/models/settings.model";
import type { SiteSettings } from "@/types/admin";

type PendingOrder = Record<string, unknown> & {
  userId: string;
  promoCode?: string | null;
};

type FinalizeResult =
  | { ok: true; order: HydratedDocument<IOrder>; alreadyProcessed: boolean }
  | { ok: false; status: number; message: string };

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_")) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

/**
 * Things the shop should look at are saved on the order as a note. The customer has paid,
 * so the order always stands:
 *  - a promo code used beyond its limit (two checkouts opened at once can both pass the limit check)
 *  - stock that ran out after the hold on it expired
 */
async function recordReviewNotes(order: HydratedDocument<IOrder>, stockNote: string | null) {
  const notes: string[] = stockNote ? [stockNote] : [];

  try {
    if (order.promoCode) {
      const settings = await Settings.findOne().lean<SiteSettings>();
      const promo = settings?.pricingSettings?.promoCodes?.find(
        (p) => p.code.toUpperCase() === order.promoCode,
      );

      if (promo) {
        const others = { promoCode: order.promoCode, paymentStatus: "PAID" as const, _id: { $ne: order._id } };
        const maxPerUser = promo.maxUsesPerUser ?? 1;
        const reasons: string[] = [];

        if (maxPerUser > 0 && (await Order.countDocuments({ ...others, userId: order.userId })) >= maxPerUser) {
          reasons.push(`this customer already used it ${maxPerUser} time(s)`);
        }
        if (promo.maxUses && promo.maxUses > 0 && (await Order.countDocuments(others)) >= promo.maxUses) {
          reasons.push(`it passed its total limit of ${promo.maxUses} uses`);
        }
        if (reasons.length) {
          notes.push(`Promo code ${order.promoCode} was used beyond its limit: ${reasons.join(" and ")}.`);
        }
      }
    }
  } catch (error) {
    console.error("[finalizeOrder] promo review check failed:", error);
  }

  if (notes.length) {
    await Order.updateOne({ _id: order._id }, { reviewNote: notes.join(" ") });
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
}): Promise<FinalizeResult> {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId } = opts;

  const existing = await Order.findOne({ razorpayOrderId });
  if (existing) {
    if (userId && String(existing.userId) !== userId) {
      return { ok: false, status: 403, message: "This order belongs to another account" };
    }
    return { ok: true, order: existing, alreadyProcessed: true };
  }

  const redis = await getRedis();
  if (!redis) return { ok: false, status: 500, message: "Redis is not configured" };

  const key = `pending_order_${razorpayOrderId}`;
  const raw = await redis.get(key);
  if (!raw) {
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

  // Atomic claim: only one caller gets the pending order, the rest see null
  const claimed = await redis.getdel(key);
  if (!claimed) {
    // Another request (the browser or the Razorpay webhook) is creating this order right now:
    // give it a moment to finish rather than telling a paying customer something went wrong.
    for (let attempt = 0; attempt < 8; attempt++) {
      const created = await Order.findOne({ razorpayOrderId });
      if (created) return { ok: true, order: created, alreadyProcessed: true };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { ok: false, status: 409, message: "Your order is being processed. Please check your orders shortly." };
  }

  let order: HydratedDocument<IOrder>;
  try {
    order = await Order.create({
      ...pending,
      promoCode: pending.promoCode ?? undefined,
      status: "PROCESSING",
      paymentStatus: "PAID",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
  } catch (error) {
    if ((error as { code?: number } | null)?.code === 11000) {
      const dup = await Order.findOne({ razorpayOrderId });
      if (dup) return { ok: true, order: dup, alreadyProcessed: true };
    }
    // Put the pending order back so a retry or the webhook can still complete it
    await redis.set(key, pending, { ex: 1800 });
    throw error;
  }

  let stockNote: string | null = null;
  try {
    stockNote = await settleStockForPaidOrder(razorpayOrderId, order.items);
  } catch (error) {
    // The customer has already paid, so never fail the order over a stock update
    console.error("[finalizeOrder] stock settle failed:", error);
  }
  await recordReviewNotes(order, stockNote);

  if (pending.promoCode && pending.userId) {
    await redis.del(`promo_lock_${pending.userId}_${String(pending.promoCode).toUpperCase()}`);
  }

  return { ok: true, order, alreadyProcessed: false };
}

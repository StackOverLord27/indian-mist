import type { HydratedDocument } from "mongoose";
import { Order, type IOrder } from "@/models/order.model";
import { settleStockForPaidOrder, consumeHold } from "@/lib/stock-reservation";
import { requireRedis } from "@/lib/redis";
import { findPromo, countPaidPromoUses } from "@/lib/promo";
import Settings from "@/models/settings.model";
import type { SiteSettings } from "@/types/admin";
import { revalidateCatalog } from "@/lib/revalidate-storefront";

type PendingOrder = Record<string, unknown> & {
  userId: string;
  promoCode?: string | null;
};

type FinalizeResult =
  | { ok: true; order: HydratedDocument<IOrder>; alreadyProcessed: boolean }
  | { ok: false; status: number; message: string };

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
      const promo = findPromo(settings?.pricingSettings?.promoCodes, order.promoCode);

      if (promo) {
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
          notes.push(`Promo code ${order.promoCode} was used beyond its limit: ${reasons.join(" and ")}.`);
        }
      }
    }
  } catch (error) {
    console.error("[finalizeOrder] promo review check failed:", error);
  }

  if (notes.length) {
    try {
      await Order.updateOne({ _id: order._id }, { reviewNote: notes.join(" ") });
    } catch (error) {
      // The customer has paid; losing the note must not fail the order
      console.error("[finalizeOrder] saving the review note failed:", error);
    }
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
    // The order exists. If an earlier run stopped before settling its stock hold, finish that now
    // (safe to repeat, and a no-op when there is nothing left to do).
    try {
      await consumeHold(razorpayOrderId);
    } catch (error) {
      console.error("[finalizeOrder] settling an earlier hold failed:", error);
    }
    return { ok: true, order: existing, alreadyProcessed: true };
  }

  const redis = requireRedis();

  const key = `pending_order_${razorpayOrderId}`;
  const raw = await redis.get(key);
  if (!raw) {
    // A paid-but-no-order case: nothing can be rebuilt. Make it visible in the logs.
    console.error(`[finalizeOrder] payment ${razorpayPaymentId} for ${razorpayOrderId}: pending order not found`);
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

  // The pending order is NOT deleted before the order exists. The unique index on
  // razorpayOrderId is what makes this exactly-once: when the browser and the webhook arrive
  // together, one create succeeds and the other gets a duplicate-key error and returns that
  // order. If this process dies before the order is saved, the pending order is still there for
  // the webhook's retry (deleting it first would lose a paid order).
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
    throw error; // the pending order is untouched, so a retry can still complete it
  }

  let stockNote: string | null = null;
  try {
    stockNote = await settleStockForPaidOrder(razorpayOrderId, order.items);
  } catch (error) {
    // The customer has already paid, so never fail the order over a stock update
    console.error("[finalizeOrder] stock settle failed:", error);
  }
  // Stock and "Sold Out" badges changed: refresh the product pages. The customer has paid, so a
  // problem here must never fail the order.
  try {
    revalidateCatalog();
  } catch (error) {
    console.error("[finalizeOrder] revalidation failed:", error);
  }
  await recordReviewNotes(order, stockNote);

  // The order is saved: the pending copy is no longer needed. A leftover one only expires later.
  try {
    await redis.del(key);
  } catch (error) {
    console.error("[finalizeOrder] removing the pending order failed:", error);
  }

  return { ok: true, order, alreadyProcessed: false };
}

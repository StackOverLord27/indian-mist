import { Order } from "@/models/order.model";
import { Product } from "@/models/product.model";

type FinalizeResult =
  | { ok: true; order: any; alreadyProcessed: boolean }
  | { ok: false; status: number; message: string };

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_")) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

async function decrementStock(items: { productId: any; quantity: number }[]) {
  for (const item of items) {
    try {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, trackInventory: true },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true },
      );
      if (updated && updated.stockQuantity <= 0) {
        await Product.updateOne(
          { _id: item.productId },
          { $set: { stockQuantity: 0, badge: "Sold Out" } },
        );
      }
    } catch (error) {
      // The customer has already paid, so never fail the order over a stock update
      console.error("[finalizeOrder] stock update failed:", item.productId, error);
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

  const pending = typeof raw === "string" ? JSON.parse(raw) : (raw as any);
  if (userId && String(pending.userId) !== userId) {
    return { ok: false, status: 403, message: "This order belongs to another account" };
  }

  // Atomic claim: only one caller gets the pending order, the rest see null
  const claimed = await redis.getdel(key);
  if (!claimed) {
    const created = await Order.findOne({ razorpayOrderId });
    if (created) return { ok: true, order: created, alreadyProcessed: true };
    return { ok: false, status: 409, message: "Your order is being processed. Please check your orders shortly." };
  }

  let order: any;
  try {
    order = await Order.create({
      ...pending,
      status: "PROCESSING",
      paymentStatus: "PAID",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      const dup = await Order.findOne({ razorpayOrderId });
      if (dup) return { ok: true, order: dup, alreadyProcessed: true };
    }
    // Put the pending order back so a retry or the webhook can still complete it
    await redis.set(key, pending, { ex: 1800 });
    throw error;
  }

  await decrementStock(order.items);

  if (pending.promoCode && pending.userId) {
    await redis.del(`promo_lock_${pending.userId}_${String(pending.promoCode).toUpperCase()}`);
  }

  return { ok: true, order, alreadyProcessed: false };
}

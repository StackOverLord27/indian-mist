import type { Types } from "mongoose";
import { Product } from "@/models/product.model";
import { StockReservation } from "@/models/stock-reservation.model";

// How long stock is held for a checkout before it is returned (matches the pending-order lifetime)
export const HOLD_MINUTES = 30;

type Id = string | Types.ObjectId;

export type ReserveItem = { productId: string; quantity: number };

type ReserveResult =
  | { ok: true; reservationId: string | null }
  | { ok: false; message: string };

async function giveBack(items: { productId: Id; quantity: number }[]) {
  for (const item of items) {
    await Product.updateOne(
      { _id: item.productId, trackInventory: true },
      { $inc: { stockQuantity: item.quantity } },
    );
  }
}

/**
 * Takes stock for products with tracking on. Each product is claimed with a single
 * database operation that only succeeds while enough stock is left, so two shoppers
 * can never both get the last unit.
 */
export async function reserveStock(userId: string, items: ReserveItem[]): Promise<ReserveResult> {
  const taken: { productId: string; quantity: number }[] = [];

  for (const item of items) {
    const claimed = await Product.findOneAndUpdate(
      { _id: item.productId, trackInventory: true, stockQuantity: { $gte: item.quantity } },
      { $inc: { stockQuantity: -item.quantity } },
    );

    if (claimed) {
      taken.push(item);
      continue;
    }

    const product = await Product.findById(item.productId).select("name trackInventory stockQuantity").lean();
    if (product && !product.trackInventory) continue; // stock is not tracked for this product

    await giveBack(taken); // undo whatever was already taken for this cart
    const left = product?.stockQuantity ?? 0;
    return {
      ok: false,
      message: left > 0 ? `Only ${left} left of ${product?.name}` : `${product?.name ?? "A product"} is out of stock`,
    };
  }

  if (taken.length === 0) return { ok: true, reservationId: null };

  const reservation = await StockReservation.create({
    userId,
    items: taken,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
  });
  return { ok: true, reservationId: String(reservation._id) };
}

export async function attachRazorpayOrder(reservationId: string, razorpayOrderId: string) {
  await StockReservation.updateOne({ _id: reservationId }, { razorpayOrderId });
}

/** Returns held stock exactly once, even if called several times at once. */
export async function releaseReservation(filter: Record<string, unknown>): Promise<boolean> {
  const released = await StockReservation.findOneAndUpdate(
    { ...filter, status: "ACTIVE" },
    { status: "RELEASED" },
  );
  if (!released) return false;
  await giveBack(released.items);
  return true;
}

/** Returns stock held by checkouts that were abandoned. */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await StockReservation.find({ status: "ACTIVE", expiresAt: { $lt: new Date() } })
    .select("_id")
    .limit(100)
    .lean();
  let count = 0;
  for (const r of expired) {
    if (await releaseReservation({ _id: r._id })) count++;
  }
  return count;
}

/** A shopper starting a new checkout gives up their earlier unpaid attempts. */
export async function releaseUserReservations(userId: string) {
  const mine = await StockReservation.find({ userId, status: "ACTIVE" }).select("_id").lean();
  for (const r of mine) await releaseReservation({ _id: r._id });
}

async function markSoldOutWhereEmpty(productIds: Id[]) {
  await Product.updateMany(
    { _id: { $in: productIds }, trackInventory: true, stockQuantity: { $lte: 0 } },
    { $set: { stockQuantity: 0, badge: "Sold Out" } },
  );
}

/**
 * Called once a payment is confirmed. Normally the stock was already held at checkout,
 * so the hold just becomes permanent. If the hold had expired, the stock is taken now;
 * if it ran out in the meantime the shopper has still paid, so the order is kept and
 * a note for the shop is returned.
 */
export async function settleStockForPaidOrder(
  razorpayOrderId: string,
  items: { productId: Id; quantity: number; name?: string }[],
): Promise<string | null> {
  const held = await StockReservation.findOneAndUpdate(
    { razorpayOrderId, status: "ACTIVE" },
    { status: "CONSUMED" },
  );

  if (held) {
    await markSoldOutWhereEmpty(held.items.map((i) => i.productId));
    return null;
  }

  const shortages: string[] = [];
  for (const item of items) {
    const claimed = await Product.findOneAndUpdate(
      { _id: item.productId, trackInventory: true, stockQuantity: { $gte: item.quantity } },
      { $inc: { stockQuantity: -item.quantity } },
    );
    if (claimed) continue;

    const product = await Product.findById(item.productId).select("name trackInventory stockQuantity").lean();
    if (product?.trackInventory) {
      shortages.push(`${product.name} (ordered ${item.quantity}, only ${product.stockQuantity} were left)`);
      await Product.updateOne({ _id: item.productId }, { $set: { stockQuantity: 0 } });
    }
  }

  await markSoldOutWhereEmpty(items.map((i) => i.productId));

  return shortages.length
    ? `Paid after the stock hold expired and stock ran out: ${shortages.join("; ")}. Decide whether to fulfil or refund.`
    : null;
}

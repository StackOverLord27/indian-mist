import type { Types } from "mongoose";
import { Product } from "@/models/product.model";
import { StockReservation } from "@/models/stock-reservation.model";

// How long stock is held for a checkout before it is returned (matches the pending-order lifetime)
export const HOLD_MINUTES = 30;

type Id = string | Types.ObjectId;

export type ReserveItem = { productId: string; size?: string; quantity: number };
type StockLine = { productId: Id; size?: string; quantity: number };

type ReserveResult =
  | { ok: true; reservationId: string | null }
  | { ok: false; message: string };

// Products without per-size stock (no sizes, or older products saved before it existed)
const NO_SIZE_STOCK = { $or: [{ sizeStock: { $exists: false } }, { sizeStock: { $size: 0 } }] };

/**
 * Takes stock for one line with a single database operation that only succeeds while enough
 * is left. Uses the size's own count when the product tracks stock per size, otherwise the
 * product total. Returns false when there is not enough.
 */
async function claim(line: StockLine): Promise<boolean> {
  if (line.size) {
    const bySize = await Product.findOneAndUpdate(
      {
        _id: line.productId,
        trackInventory: true,
        sizeStock: { $elemMatch: { size: line.size, quantity: { $gte: line.quantity } } },
      },
      { $inc: { "sizeStock.$.quantity": -line.quantity, stockQuantity: -line.quantity } },
    );
    if (bySize) return true;
  }
  const total = await Product.findOneAndUpdate(
    { _id: line.productId, trackInventory: true, stockQuantity: { $gte: line.quantity }, ...NO_SIZE_STOCK },
    { $inc: { stockQuantity: -line.quantity } },
  );
  return !!total;
}

/** Puts units back, on the size's count when the product tracks per size. */
export async function restoreStock(lines: StockLine[]) {
  for (const line of lines) {
    if (line.size) {
      const bySize = await Product.updateOne(
        { _id: line.productId, trackInventory: true, "sizeStock.size": line.size },
        { $inc: { "sizeStock.$.quantity": line.quantity, stockQuantity: line.quantity } },
      );
      if (bySize.matchedCount > 0) continue;
    }
    await Product.updateOne(
      { _id: line.productId, trackInventory: true },
      { $inc: { stockQuantity: line.quantity } },
    );
  }
}

/** How many units of this line are left, or null when stock is not tracked. */
async function unitsLeft(line: StockLine): Promise<{ name: string; left: number } | null> {
  const product = await Product.findById(line.productId).select("name trackInventory stockQuantity sizeStock").lean();
  if (!product || !product.trackInventory) return null;
  const entry = line.size ? product.sizeStock?.find((s) => s.size === line.size) : undefined;
  return { name: product.name, left: entry ? entry.quantity : (product.sizeStock?.length ? 0 : product.stockQuantity ?? 0) };
}

/**
 * Takes stock for products with tracking on. Each line is claimed atomically, so two
 * shoppers can never both get the last unit.
 */
export async function reserveStock(userId: string, items: ReserveItem[]): Promise<ReserveResult> {
  const taken: ReserveItem[] = [];

  // Always claim in the same order. Two carts holding the same products in opposite order
  // would otherwise each grab one item, fail on the other and roll back, both falsely "out of stock".
  const ordered = [...items].sort((x, y) =>
    `${x.productId}|${x.size ?? ""}`.localeCompare(`${y.productId}|${y.size ?? ""}`),
  );

  for (const item of ordered) {
    if (await claim(item)) {
      taken.push(item);
      continue;
    }

    const info = await unitsLeft(item);
    if (!info) {
      // Either stock is not tracked for this product (fine), or the product is gone
      if (await Product.exists({ _id: item.productId })) continue;
    }

    await restoreStock(taken); // undo whatever was already taken for this cart
    const label = info ? `${info.name}${item.size ? ` (${item.size})` : ""}` : "A product";
    const left = info?.left ?? 0;
    return {
      ok: false,
      message: left > 0 ? `Only ${left} left of ${label}` : `${label} is out of stock`,
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
  await restoreStock(released.items);
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
  items: { productId: Id; selectedSize?: string; quantity: number; name?: string }[],
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
    const line = { productId: item.productId, size: item.selectedSize, quantity: item.quantity };
    if (await claim(line)) continue;

    const info = await unitsLeft(line);
    if (!info) continue;
    const label = `${info.name}${item.selectedSize ? ` (${item.selectedSize})` : ""}`;
    shortages.push(`${label} (ordered ${item.quantity}, only ${info.left} were left)`);
    // Whatever was left is gone: zero it and keep the product total in step
    if (item.selectedSize) {
      await Product.updateOne(
        { _id: item.productId, "sizeStock.size": item.selectedSize },
        { $set: { "sizeStock.$.quantity": 0 }, $inc: { stockQuantity: -info.left } },
      );
    } else {
      await Product.updateOne({ _id: item.productId }, { $set: { stockQuantity: 0 } });
    }
  }

  await markSoldOutWhereEmpty(items.map((i) => i.productId));

  return shortages.length
    ? `Paid after the stock hold expired and stock ran out: ${shortages.join("; ")}. Decide whether to fulfil or refund.`
    : null;
}

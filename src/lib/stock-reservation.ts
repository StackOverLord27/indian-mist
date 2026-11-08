import mongoose, { type ClientSession, type Types } from "mongoose";
import { Product } from "@/models/product.model";
import { StockReservation } from "@/models/stock-reservation.model";
import { Order } from "@/models/order.model";
import { addReviewNote } from "@/lib/review-note";
import { HOLD_MINUTES } from "@/lib/checkout-timing";

// How long stock is held for a checkout before it is returned to sale (defined in checkout-timing.ts
// so the browser's payment window can be derived from the same number).
// This is deliberately SHORT and separate from PENDING_ORDER_TTL_SECONDS below: a hold only keeps
// stock off the shelf while the shopper is paying; the pending order must live much longer so a
// payment that lands after the hold expired can still become an order.
export { HOLD_MINUTES };

/**
 * How long what finalizeOrder needs to create the order after payment (the pending order in
 * Redis) is kept: 24 hours. Used by create-order and by finalizeOrder's rollback, so the two
 * can never disagree.
 */
export const PENDING_ORDER_TTL_SECONDS = 24 * 60 * 60;

type Id = string | Types.ObjectId;

/**
 * Runs several database writes as ONE all-or-nothing step (a Mongo transaction; Atlas and the
 * local test container are replica sets). The callback may run again after a transient conflict,
 * so it must only touch the database, through the session it is given.
 */
export function inTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(fn) as Promise<T>;
}

/** A paid order younger than this is left to the request that is still creating it. */
const UNSETTLED_GRACE_MS = 2 * 60 * 1000;

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
async function claim(line: StockLine, session?: ClientSession): Promise<boolean> {
  if (line.size) {
    const bySize = await Product.findOneAndUpdate(
      {
        _id: line.productId,
        trackInventory: true,
        sizeStock: { $elemMatch: { size: line.size, quantity: { $gte: line.quantity } } },
      },
      { $inc: { "sizeStock.$.quantity": -line.quantity, stockQuantity: -line.quantity } },
      { session },
    );
    if (bySize) return true;
  }
  const total = await Product.findOneAndUpdate(
    { _id: line.productId, trackInventory: true, stockQuantity: { $gte: line.quantity }, ...NO_SIZE_STOCK },
    { $inc: { stockQuantity: -line.quantity } },
    { session },
  );
  return !!total;
}

/** Puts units back, on the size's count when the product tracks per size. */
export async function restoreStock(lines: StockLine[], session?: ClientSession) {
  for (const line of lines) {
    if (line.size) {
      const bySize = await Product.updateOne(
        { _id: line.productId, trackInventory: true, "sizeStock.size": line.size },
        { $inc: { "sizeStock.$.quantity": line.quantity, stockQuantity: line.quantity } },
        { session },
      );
      if (bySize.matchedCount > 0) continue;
    }
    await Product.updateOne(
      { _id: line.productId, trackInventory: true },
      { $inc: { stockQuantity: line.quantity } },
      { session },
    );
  }
}

/** How many units of this line are left, or null when stock is not tracked. */
async function unitsLeft(line: StockLine, session?: ClientSession): Promise<{ name: string; left: number } | null> {
  const product = await Product.findById(line.productId).select("name trackInventory stockQuantity sizeStock").session(session ?? null).lean();
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

  // The stock is already taken at this point. If the record that lets it be returned cannot be
  // saved, give the stock back right away: otherwise it would be missing from sale for good.
  try {
    const reservation = await StockReservation.create({
      userId,
      items: taken,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
    });
    return { ok: true, reservationId: String(reservation._id) };
  } catch (error) {
    await restoreStock(taken);
    throw error;
  }
}

export async function attachRazorpayOrder(reservationId: string, razorpayOrderId: string) {
  await StockReservation.updateOne({ _id: reservationId }, { razorpayOrderId });
}

/**
 * Returns held stock exactly once, even if called several times at once. The status change from
 * ACTIVE and the restocking are ONE transaction: a crash can neither leave a RELEASED hold whose
 * stock was never returned, nor return it twice.
 *
 * A hold whose Razorpay order has already become an order is not released: that stock was sold.
 */
export async function releaseReservation(filter: Record<string, unknown>): Promise<boolean> {
  const released = await inTransaction(async (session) => {
    const held = await StockReservation.findOne({ ...filter, status: "ACTIVE" }).session(session);
    if (!held) return null;
    if (held.razorpayOrderId && (await Order.exists({ razorpayOrderId: held.razorpayOrderId }).session(session))) return null;
    // Same transaction: the status change only sticks if the stock goes back
    const claimed = await StockReservation.findOneAndUpdate(
      { _id: held._id, status: "ACTIVE" },
      { status: "RELEASED" },
      { session },
    );
    if (!claimed) return null;
    await restoreStock(claimed.items, session);
    return claimed;
  });
  if (!released) return false;
  // Stock is back on sale: an automatic "Sold Out" label set while it was all held no longer applies
  await clearSoldOutWhereInStock(released.items.map((i) => i.productId));
  return true;
}

/**
 * The hold of an order that has been paid becomes permanent (CONSUMED). Exactly once, and safe
 * to call again. Returns false when there was no active hold to consume.
 */
export async function consumeHold(razorpayOrderId: string): Promise<boolean> {
  const held = await StockReservation.findOneAndUpdate(
    { razorpayOrderId, status: "ACTIVE" },
    { status: "CONSUMED" },
  );
  if (!held) return false;
  await markSoldOutWhereEmpty(held.items.map((i) => i.productId));
  return true;
}

/**
 * Returns stock held by checkouts that were abandoned.
 *
 * A hold whose Razorpay order has ALREADY been turned into a paid order is not abandoned: the
 * order was created but the process stopped before the stock was settled. Giving that stock back
 * would sell it twice, so such a hold is consumed instead.
 */
export async function releaseExpiredReservations(): Promise<number> {
  let count = 0;
  for (let batch = 0; batch < 5; batch++) {
    const expired = await StockReservation.find({ status: "ACTIVE", expiresAt: { $lt: new Date() } })
      .select("_id razorpayOrderId")
      .limit(100)
      .lean();
    for (const r of expired) {
      const paid = r.razorpayOrderId
        ? await Order.findOne({ razorpayOrderId: r.razorpayOrderId }).select("_id stockSettled").lean()
        : null;
      if (paid) {
        // Paid: finish settling it (new orders), or just make the hold permanent (older orders)
        if (paid.stockSettled === false) await settleOrderStock(paid._id);
        else await consumeHold(r.razorpayOrderId!);
        continue;
      }
      if (await releaseReservation({ _id: r._id })) count++;
    }
    if (expired.length < 100) break;
  }
  try {
    await repairUnsettledOrders();
  } catch (error) {
    console.error("[stock] repairing unsettled orders failed:", error);
  }
  return count;
}

/**
 * Paid orders whose stock was never settled (the process stopped right after the order was
 * saved) are finished here. Exactly once: settleOrderStock only acts on stockSettled === false.
 */
export async function repairUnsettledOrders(): Promise<number> {
  const stuck = await Order.find({
    stockSettled: false,
    createdAt: { $lt: new Date(Date.now() - UNSETTLED_GRACE_MS) },
  })
    .select("_id")
    .limit(50)
    .lean();
  let repaired = 0;
  for (const o of stuck) {
    try {
      await settleOrderStock(o._id);
      repaired++;
    } catch (error) {
      console.error(`[stock] settling order ${String(o._id)} failed:`, error);
    }
  }
  return repaired;
}

// ─── Lazy sweep ────────────────────────────────────────────────────────────────
// There is no background process on serverless, so expired holds are released right before code
// reads stock. Each server instance does this at most once a minute, so it costs almost nothing.
const SWEEP_EVERY_MS = 60_000;
let lastSweepAt = 0;

/** Release expired holds before reading stock. Throttled per instance; never throws (a failing sweep must not break a page). */
export async function sweepExpiredReservations(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now; // set before awaiting, so concurrent callers on this instance skip
  try {
    await releaseExpiredReservations();
  } catch (error) {
    lastSweepAt = 0; // try again on the next call
    console.error("[stock] sweeping expired holds failed:", error);
  }
}

export function resetSweepThrottleForTests() {
  lastSweepAt = 0;
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

/** Removes the automatic "Sold Out" label from products that have stock again. */
export async function clearSoldOutWhereInStock(productIds: Id[]) {
  await Product.updateMany(
    { _id: { $in: productIds }, trackInventory: true, badge: "Sold Out", stockQuantity: { $gt: 0 } },
    { $set: { badge: "" } },
  );
}

/**
 * Called once a payment is confirmed and the order exists. Normally the stock was already held at
 * checkout, so the hold just becomes permanent. If the hold had expired, the stock is taken now;
 * if it ran out in the meantime the shopper has still paid, so the order is kept and a note for
 * the shop is saved on it.
 *
 * Everything happens in ONE transaction together with the order's stockSettled flag, so a crash
 * leaves the order unsettled (a repair pass finishes it) and a repeat or a parallel call does
 * nothing. The units really taken from stock are recorded on each order line (deductedQuantity),
 * which is what cancelling gives back. Returns the shop note, or null.
 */
export async function settleOrderStock(orderId: Id): Promise<string | null> {
  const note = await inTransaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, stockSettled: false },
      { $set: { stockSettled: true } },
      { session, returnDocument: "after" },
    );
    if (!order) return null; // already settled (or an older order)

    // The hold of this checkout: active now, or made permanent earlier
    let heldItems: { productId: Id; size?: string; quantity: number }[] | null = null;
    if (order.razorpayOrderId) {
      const hold =
        (await StockReservation.findOneAndUpdate(
          { razorpayOrderId: order.razorpayOrderId, status: "ACTIVE" },
          { status: "CONSUMED" },
          { session },
        )) ??
        (await StockReservation.findOne({ razorpayOrderId: order.razorpayOrderId, status: "CONSUMED" }).session(session));
      heldItems = hold?.items ?? null;
    }

    const shortages: string[] = [];
    const sets: Record<string, number> = {};
    for (const [index, item] of order.items.entries()) {
      const line = { productId: item.productId, size: item.selectedSize, quantity: item.quantity };

      if (heldItems) {
        // Taken at checkout (untracked products were never part of the hold)
        sets[`items.${index}.deductedQuantity`] = heldItems
          .filter((h) => String(h.productId) === String(item.productId) && (h.size ?? "") === (item.selectedSize ?? ""))
          .reduce((n, h) => n + h.quantity, 0);
        continue;
      }

      if (await claim(line, session)) {
        sets[`items.${index}.deductedQuantity`] = item.quantity;
        continue;
      }
      const info = await unitsLeft(line, session);
      if (!info) {
        sets[`items.${index}.deductedQuantity`] = 0; // stock is not tracked (or the product is gone)
        continue;
      }
      const label = `${info.name}${item.selectedSize ? ` (${item.selectedSize})` : ""}`;
      shortages.push(`${label} (ordered ${item.quantity}, only ${info.left} were left)`);
      sets[`items.${index}.deductedQuantity`] = info.left;
      // Whatever was left is gone: zero it and keep the product total in step
      if (item.selectedSize) {
        await Product.updateOne(
          { _id: item.productId, "sizeStock.size": item.selectedSize },
          { $set: { "sizeStock.$.quantity": 0 }, $inc: { stockQuantity: -info.left } },
          { session },
        );
      } else {
        await Product.updateOne({ _id: item.productId }, { $set: { stockQuantity: 0 } }, { session });
      }
    }

    if (Object.keys(sets).length) await Order.updateOne({ _id: order._id }, { $set: sets }, { session });
    const shortageNote = shortages.length
      ? `Paid after the stock hold expired and stock ran out: ${shortages.join("; ")}. Decide whether to fulfil or refund.`
      : null;
    if (shortageNote) await addReviewNote(order._id, shortageNote, session);
    return { productIds: order.items.map((i) => i.productId), shortageNote };
  });

  if (!note) return null;
  await markSoldOutWhereEmpty(note.productIds);
  return note.shortageNote;
}

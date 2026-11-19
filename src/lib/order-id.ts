import { createHash } from "crypto";
import { Types } from "mongoose";

/**
 * The database id of the order for one Razorpay order, worked out from the Razorpay order id.
 *
 * Why: "one order per payment" must not depend on an index that someone could forget to build (the
 * live database once had a PLAIN razorpayOrderId index, so the browser confirmation and the webhook
 * each created an order). MongoDB's own `_id` index is always there and always unique, so when
 * every attempt to create the order for a given Razorpay order uses the SAME `_id`, the database
 * itself lets exactly one of them in and answers the others with a duplicate-key error. No lock,
 * no Redis, nothing to expire. (96 bits of a SHA-256: two different Razorpay orders cannot collide
 * in practice. Older orders keep their time-based ids.)
 */
export function orderIdForRazorpayOrder(razorpayOrderId: string): Types.ObjectId {
  const hex = createHash("sha256").update(`indian-mist:order:${razorpayOrderId}`).digest("hex").slice(0, 24);
  return new Types.ObjectId(hex);
}

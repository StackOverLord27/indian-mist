import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { Order } from "@/models/order.model";
import { Product } from "@/models/product.model";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";
import { EmailLog } from "@/models/email-log.model";
import { samePaymentText, reviewNoteForDisplay } from "@/lib/duplicate-note";
import { resolveOwnerAddress } from "./config";
import { buildOrderData } from "./order-data";
import { PAYMENT_ALERT_KINDS, type EmailData, type PaymentAlertKind } from "./types";
import { lowStockSettings } from "@/lib/low-stock";

/**
 * Building the shop owner's e-mails from the database. As for the customer's e-mails, the same
 * function builds the first send and every retry or Resend (bodies are never stored), and the
 * recipient is looked up again each time (the owner address may have been changed since).
 * Every builder returns null when there is nothing (any more) to say.
 */

export const paymentAlertId = (kind: PaymentAlertKind, paymentId: string) => `${kind}:${paymentId}`;
/** Razorpay ids are letters, digits and underscores; anything else is not put in an alert. */
export const SAFE_PAYMENT_ID = /^[A-Za-z0-9_]{1,64}$/;

export async function buildOwnerNewOrder(orderId: string): Promise<{ to: string; data: EmailData["owner-new-order"] } | null> {
  const [to, data] = [await resolveOwnerAddress(), await buildOrderData(orderId)];
  return to && data ? { to, data } : null;
}

export async function buildPaymentAlert(relatedId: string): Promise<{ to: string; data: EmailData["owner-payment-alert"] } | null> {
  const m = /^([a-z-]+):([A-Za-z0-9_]{1,64})$/.exec(relatedId);
  if (!m || !(PAYMENT_ALERT_KINDS as readonly string[]).includes(m[1])) return null;
  const kind = m[1] as PaymentAlertKind;
  const paymentId = m[2];
  const to = await resolveOwnerAddress();
  if (!to) return null;
  await dbConnect();

  if (kind === "payment-without-order") {
    const u = await UnmatchedPayment.findOne({ razorpayPaymentId: paymentId }).lean();
    return u ? { to, data: { kind, razorpayOrderId: u.razorpayOrderId, razorpayPaymentId: paymentId, amount: u.amount } } : null;
  }

  const orders = await Order.find({ razorpayPaymentId: paymentId }).sort({ createdAt: -1 }).select("razorpayOrderId totalAmount reviewNote").lean();
  const order = orders[0];
  if (!order) return null;
  const others = orders.slice(1).map((o) => o._id);
  const base = { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: paymentId, orderId: String(order._id), amount: order.totalAmount };
  if (kind === "duplicate-payment") return { to, data: { kind, ...base, note: samePaymentText(others) } };
  if (kind === "refund-due") return { to, data: { kind, ...base } };
  return { to, data: { kind, ...base, note: reviewNoteForDisplay(order.reviewNote, others.length ? others : undefined) } };
}

/** The shop's day, "YYYY-MM-DD", for the once-a-day failed-e-mail summary. */
export const summaryDay = (at = Date.now()) => new Date(at + 5.5 * 3600_000).toISOString().slice(0, 10);

export async function buildFailedSummary(date: string): Promise<{ to: string; data: EmailData["owner-failed-summary"] } | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const to = await resolveOwnerAddress();
  if (!to) return null;
  await dbConnect();
  const groups = await EmailLog.aggregate<{ _id: string; count: number }>([
    { $match: { status: "failed", permanent: true, summaryDate: date } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  if (!groups.length) return null;
  return { to, data: { date, total: groups.reduce((n, g) => n + g.count, 0), byType: groups.map((g) => ({ type: g._id, count: g.count })) } };
}

/** Related id "<product id>.<time the drop was noticed, ms>": one e-mail per drop. */
export const lowStockId = (productId: unknown, at: number) => `${String(productId)}.${at}`;

export async function buildLowStock(relatedId: string): Promise<{ to: string; data: EmailData["owner-low-stock"] } | null> {
  const m = /^([a-f0-9]{24})\.(\d{10,15})$/.exec(relatedId);
  if (!m || !mongoose.isValidObjectId(m[1])) return null;
  const to = await resolveOwnerAddress();
  if (!to) return null;
  await dbConnect();
  const product = await Product.findById(m[1]).select("name stockQuantity").lean();
  if (!product) return null;
  const { threshold } = await lowStockSettings();
  return { to, data: { productId: m[1], name: product.name, left: product.stockQuantity ?? 0, threshold } };
}

import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import { loadShopInfo } from "./config";
import { ORDER_EMAIL_TYPES, type EmailData, type OrderEmailType, type OrderMailData } from "./types";

/**
 * Building an e-mail from the database. The same function builds the first send AND every retry
 * and Resend (bodies are never stored), so a retried e-mail always says what is true at the time
 * it goes out, to the account that owns the order.
 */

/**
 * The recipient is the e-mail of the ACCOUNT that owns the order (User.email), never the address
 * typed into the checkout form: that one is free text and may belong to someone else.
 */
export async function buildOrderMail(orderId: string): Promise<{ to: string; data: OrderMailData } | null> {
  if (!mongoose.isValidObjectId(orderId)) return null;
  await dbConnect();
  const order = await Order.findById(orderId).lean();
  if (!order) return null;
  const owner = await User.findById(order.userId).select("email").lean<{ email?: string }>();
  const to = owner?.email?.trim();
  if (!to) return null;
  const shop = await loadShopInfo();
  return {
    to,
    data: {
      orderId: String(order._id),
      customerName: order.customerName,
      placedAt: order.createdAt.toISOString(),
      lines: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.priceAtPurchase, size: i.selectedSize || undefined, color: i.selectedColor || undefined })),
      subtotal: order.subtotal ?? 0,
      shipping: order.shippingCost ?? 0,
      discount: order.discountAmount ?? 0,
      promoCode: order.promoCode || undefined,
      tax: order.taxAmount ?? 0,
      total: order.totalAmount,
      address: {
        street: order.shippingAddress.street, city: order.shippingAddress.city, state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode, country: order.shippingAddress.country,
      },
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      refundStatus: order.refundStatus || undefined,
      courier: order.courier || undefined,
      trackingNumber: order.trackingNumber || undefined,
      trackingUrl: order.trackingUrl || undefined,
      shop,
    },
  };
}

/** Password notice related id: "<user id>.<time of the change in ms>", so each change is its own e-mail and a retry can rebuild it. */
export const passwordChangedId = (userId: unknown, at = Date.now()) => `${String(userId)}.${at}`;

export async function buildPasswordChangedMail(relatedId: string): Promise<{ to: string; data: EmailData["password-changed"] } | null> {
  const m = /^([a-f0-9]{24})\.(\d{10,15})$/.exec(relatedId);
  if (!m) return null;
  await dbConnect();
  const user = await User.findById(m[1]).select("email name").lean<{ email?: string; name?: string }>();
  if (!user?.email) return null;
  return { to: user.email, data: { name: user.name || "", changedAt: new Date(Number(m[2])).toISOString(), shop: await loadShopInfo() } };
}

type AnyBuilder = (relatedId: string) => Promise<{ to: string; data: never } | null>;

/** Retry and Resend look these up (see getBuilder in index.ts). */
export const STATIC_BUILDERS: Partial<Record<string, AnyBuilder>> = {
  ...Object.fromEntries(ORDER_EMAIL_TYPES.map((t: OrderEmailType) => [t, buildOrderMail as unknown as AnyBuilder])),
  "password-changed": buildPasswordChangedMail as unknown as AnyBuilder,
};

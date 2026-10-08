export const runtime = "nodejs";

import {
  reserveStock,
  releaseReservation,
  releaseExpiredReservations,
  releaseUserReservations,
  attachRazorpayOrder,
} from "@/lib/stock-reservation";
import type { SiteSettings } from "@/types/admin";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import { Product } from "@/models/product.model";
import Settings from "@/models/settings.model";
import { SHIPPING_COST, SHIPPING_THRESHOLD } from "@/lib/constants";
import { CreateOrderSchema } from "@/schemas/checkout-api";
import Razorpay from "razorpay";

const MAX_QTY_PER_ITEM = 50;

type OrderLine = {
  productId: unknown;
  name: string;
  quantity: number;
  priceAtPurchase: number;
  image: string;
  selectedSize?: string;
  selectedColor?: string;
};

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsedBody = CreateOrderSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const {
    items,
    customerName,
    email,
    phone,
    shippingAddress,
    saveAddress,
    promoCode,
    deliveryNotes,
  } = parsedBody.data;

  // ─── Prices come from the database, never from the browser ──────────────
  const requestedIds: string[] = items.map((i) => String(i?.productId ?? ""));
  if (requestedIds.some((id) => !id)) return errorResponse("Invalid cart item", 400);

  const objectIds = requestedIds.filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({
    $or: [{ _id: { $in: objectIds } }, { slug: { $in: requestedIds } }],
  }).lean();

  const productByKey = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    productByKey.set(String(p._id), p);
    productByKey.set(p.slug, p);
  }

  const orderItems: OrderLine[] = [];
  const requestedQty = new Map<string, number>();
  let subtotal = 0;

  for (const item of items) {
    const product = productByKey.get(String(item.productId));
    if (!product) return errorResponse("A product in your cart is no longer available", 400);
    if (product.badge === "Sold Out") {
      return errorResponse(`${product.name} is sold out`, 400);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      return errorResponse("Invalid item quantity", 400);
    }

    if (product.sizes?.length && item.size && !product.sizes.includes(item.size)) {
      return errorResponse(`Invalid size for ${product.name}`, 400);
    }
    if (product.colors?.length && item.color && !product.colors.includes(item.color)) {
      return errorResponse(`Invalid color for ${product.name}`, 400);
    }

    requestedQty.set(String(product._id), (requestedQty.get(String(product._id)) ?? 0) + quantity);
    subtotal += product.price * quantity;
    orderItems.push({
      productId: product._id,
      name: product.name,
      quantity,
      priceAtPurchase: product.price,
      image: product.images?.[0]?.url || "",
      selectedSize: item.size,
      selectedColor: item.color,
    });
  }

  // ─── Settings: shipping rates and promo codes ────────────────────────────
  const settings = await Settings.findOne().lean<SiteSettings>();
  const shippingRate = settings?.pricingSettings?.shippingCost ?? SHIPPING_COST;
  const freeThreshold = settings?.pricingSettings?.freeShippingThreshold ?? SHIPPING_THRESHOLD;

  // Re-validate promo code at order creation time (prevents manipulation)
  let validatedPromoCode: string | null = null;
  let validatedDiscount = 0;

  if (promoCode && typeof promoCode === "string") {
    const promoCodes = settings?.pricingSettings?.promoCodes || [];
    const normalizedCode = promoCode.trim().toUpperCase();
    const promo = promoCodes.find(
      (p) => p.code.toUpperCase() === normalizedCode,
    );

    if (!promo || !promo.isActive) {
      return errorResponse("Promo code is no longer valid", 400);
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return errorResponse("Promo code has expired", 400);
    }

    if (promo.minOrderValue && subtotal < promo.minOrderValue) {
      return errorResponse(
        `This promo code requires a minimum order of ₹${promo.minOrderValue}`,
        400,
      );
    }

    const maxPerUser = promo.maxUsesPerUser ?? 1;
    if (maxPerUser > 0) {
      const userUsageCount = await Order.countDocuments({
        userId,
        promoCode: normalizedCode,
        paymentStatus: "PAID",
      });
      if (userUsageCount >= maxPerUser) {
        return errorResponse("You have already used this promo code", 400);
      }
    }

    if (promo.maxUses && promo.maxUses > 0) {
      const totalUsageCount = await Order.countDocuments({
        promoCode: normalizedCode,
        paymentStatus: "PAID",
      });
      if (totalUsageCount >= promo.maxUses) {
        return errorResponse(
          "This promo code has reached its usage limit",
          400,
        );
      }
    }

    let calculatedDiscount = 0;
    if (promo.discountType === "PERCENTAGE") {
      const pct = Math.min(Math.max(Number(promo.discountValue) || 0, 0), 100);
      calculatedDiscount = Math.floor(subtotal * (pct / 100));
    } else {
      calculatedDiscount = Number(promo.discountValue) || 0;
    }
    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    validatedPromoCode = normalizedCode;
    validatedDiscount = calculatedDiscount;
  }

  // ─── Totals (same rules the checkout page displays) ──────────────────────
  const shippingCost = subtotal >= freeThreshold ? 0 : shippingRate;
  const taxAmount = 0; // GST disabled — no GST registration yet
  const totalAmount = Math.max(subtotal - validatedDiscount, 0) + shippingCost + taxAmount;

  if (totalAmount < 1) return errorResponse("Order total is too low", 400);

  // ─── Hold the stock for this checkout ─────────────────────────────────────
  // The stock is taken in one atomic step, so two shoppers can never both get the last unit.
  await releaseExpiredReservations();
  await releaseUserReservations(userId);
  const hold = await reserveStock(
    userId,
    [...requestedQty].map(([productId, quantity]) => ({ productId, quantity })),
  );
  if (!hold.ok) return errorResponse(hold.message, 400);
  const releaseHold = async () => {
    if (hold.reservationId) await releaseReservation({ _id: hold.reservationId });
  };

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "dummy_key_for_build",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret_for_build",
  });

  // Create Razorpay order
  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // Razorpay expects amount in paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        customerName,
        email,
      },
    });
  } catch (error) {
    await releaseHold();
    throw error;
  }
  if (hold.reservationId) await attachRazorpayOrder(hold.reservationId, razorpayOrder.id);

  // Store pending order details in Redis for up to 30 minutes
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken || redisUrl.startsWith("your_")) {
    await releaseHold();
    return errorResponse("Redis is not configured for pending orders", 500);
  }

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const orderData = {
    userId,
    items: orderItems,
    totalAmount,
    subtotal,
    shippingCost,
    taxAmount,
    discountAmount: validatedDiscount,
    promoCode: validatedPromoCode,
    customerName,
    email,
    phone,
    shippingAddress: {
      ...shippingAddress,
      country: shippingAddress.country || "India",
    },
    ...(deliveryNotes?.trim() && { deliveryNotes: deliveryNotes.trim() }),
  };

  // Store the data in Redis securely using the razorpay order id (expires in 30 mins)
  try {
    await redis.set(`pending_order_${razorpayOrder.id}`, orderData, { ex: 1800 });
  } catch (error) {
    await releaseHold();
    throw error;
  }

  // If the user checked "Save this address", update their profile
  if (saveAddress) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        shippingAddress: {
          ...shippingAddress,
          country: shippingAddress.country || "India",
        },
        name: customerName,
        phone: phone,
      },
    });
  }

  return successResponse({
    razorpayOrderId: razorpayOrder.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    totalAmount,
  });
});

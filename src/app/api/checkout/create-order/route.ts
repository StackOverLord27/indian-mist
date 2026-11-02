export const runtime = "nodejs";

import {
  reserveStock,
  releaseReservation,
  releaseExpiredReservations,
  releaseUserReservations,
  attachRazorpayOrder,
  PENDING_ORDER_TTL_SECONDS,
} from "@/lib/stock-reservation";
import { normalizePromoCode, findPromo, countPaidPromoUses, promoDiscount } from "@/lib/promo";
import { requireRedis } from "@/lib/redis";
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
import { getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/env";

const MAX_QTY_PER_ITEM = 50;

type OrderLine = {
  productId: unknown;
  name: string;
  quantity: number;
  priceAtPurchase: number;
  image: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedColorHex?: string;
};

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  // Read the Razorpay keys first: a missing key throws here (naming the variable, never a dummy
  // fallback) before any stock is held.
  const razorpayKeyId = getRazorpayKeyId();
  const razorpayKeySecret = getRazorpayKeySecret();
  // Same for Redis: without it the order could be paid but never created, so fail before holding stock
  const redis = requireRedis();

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
  const orderLines = new Map<string, OrderLine>();
  // Quantity wanted per product + size, so each size's stock is checked on its own
  const requestedQty = new Map<string, { productId: string; size?: string; quantity: number }>();
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
    if (product.trackInventory && product.sizeStock?.length && !item.size) {
      return errorResponse(`Please choose a size for ${product.name}`, 400);
    }

    // One order line per product + size, even if the request lists it more than once
    const lineKey = `${product._id}|${item.size ?? ""}`;
    const lineSoFar = requestedQty.get(lineKey);
    const mergedQuantity = (lineSoFar?.quantity ?? 0) + quantity;
    if (mergedQuantity > MAX_QTY_PER_ITEM) {
      return errorResponse(`You can order at most ${MAX_QTY_PER_ITEM} of ${product.name}`, 400);
    }
    requestedQty.set(lineKey, {
      productId: String(product._id),
      size: item.size || undefined,
      quantity: mergedQuantity,
    });

    subtotal += product.price * quantity;
    const line = orderLines.get(lineKey);
    if (line) {
      line.quantity = mergedQuantity;
      continue;
    }
    const newLine: OrderLine = {
      productId: product._id,
      name: product.name,
      quantity: mergedQuantity,
      priceAtPurchase: product.price,
      image: product.images?.[0]?.url || "",
      selectedSize: item.size || undefined,
      selectedColor: product.colorName || item.color,
      selectedColorHex: product.colorHex || undefined,
    };
    orderLines.set(lineKey, newLine);
    orderItems.push(newLine);
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
    const normalizedCode = normalizePromoCode(promoCode);
    const promo = findPromo(promoCodes, normalizedCode);

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

    // Only PAID orders use up a code (see lib/promo.ts)
    const maxPerUser = promo.maxUsesPerUser ?? 1;
    if (maxPerUser > 0) {
      const userUsageCount = await countPaidPromoUses(normalizedCode, { userId });
      if (userUsageCount >= maxPerUser) {
        return errorResponse("You have already used this promo code", 400);
      }
    }

    if (promo.maxUses && promo.maxUses > 0) {
      const totalUsageCount = await countPaidPromoUses(normalizedCode);
      if (totalUsageCount >= promo.maxUses) {
        return errorResponse(
          "This promo code has reached its usage limit",
          400,
        );
      }
    }

    validatedPromoCode = normalizedCode;
    validatedDiscount = promoDiscount(promo, subtotal);
  }

  // ─── Totals (same rules the checkout page displays) ──────────────────────
  const shippingCost = subtotal >= freeThreshold ? 0 : shippingRate;
  const taxAmount = 0; // GST disabled — no GST registration yet
  // Whole paise, so the amount stored on the order and the amount charged are always the same number
  const totalPaise = Math.round((Math.max(subtotal - validatedDiscount, 0) + shippingCost + taxAmount) * 100);
  const totalAmount = totalPaise / 100;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) return errorResponse("Order total is too low", 400);

  // ─── Hold the stock for this checkout ─────────────────────────────────────
  // The stock is taken in one atomic step, so two shoppers can never both get the last unit.
  await releaseExpiredReservations();
  await releaseUserReservations(userId);
  const hold = await reserveStock(
    userId,
    [...requestedQty.values()],
  );
  if (!hold.ok) return errorResponse(hold.message, 400);
  const releaseHold = async () => {
    if (hold.reservationId) await releaseReservation({ _id: hold.reservationId });
  };

  // From here on the stock is held: whatever goes wrong, give it back before reporting the error
  try {
    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });

    const razorpayOrder = await razorpay.orders.create({
      amount: totalPaise, // Razorpay expects whole paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        customerName,
        email,
      },
    });
    if (hold.reservationId) await attachRazorpayOrder(hold.reservationId, razorpayOrder.id);

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

    // What finalizeOrder needs to create the order once the payment is confirmed. It outlives the
    // stock hold on purpose, so a late payment still becomes an order.
    await redis.set(`pending_order_${razorpayOrder.id}`, orderData, { ex: PENDING_ORDER_TTL_SECONDS });

    // If the shopper ticked "Save this address", update their profile. This is a convenience: if
    // it fails the checkout carries on (the payment must not be blocked by it).
    if (saveAddress) {
      try {
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
      } catch (error) {
        console.error("[create-order] saving the address failed:", error);
      }
    }

    return successResponse({
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      totalAmount,
    });
  } catch (error) {
    await releaseHold();
    throw error;
  }
});

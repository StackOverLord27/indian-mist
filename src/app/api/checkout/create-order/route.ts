export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import Razorpay from "razorpay";

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  const body = await req.json();
  const {
    items,
    subtotal,
    shippingCost,
    taxAmount,
    totalAmount,
    customerName,
    email,
    phone,
    shippingAddress,
    saveAddress,
    promoCode,
    discountAmount,
    deliveryNotes,
  } = body;

  if (!items?.length) return errorResponse("Cart is empty", 400);
  if (!customerName || !email || !phone)
    return errorResponse("Customer details are required", 400);
  if (
    !shippingAddress?.street ||
    !shippingAddress?.city ||
    !shippingAddress?.state ||
    !shippingAddress?.zipCode
  )
    return errorResponse("Complete shipping address is required", 400);

  // Re-validate promo code at order creation time (prevents manipulation)
  let validatedPromoCode: string | null = null;
  let validatedDiscount = 0;

  if (promoCode && typeof promoCode === "string") {
    const Settings = (await import("@/models/settings.model")).default;
    const settings = await Settings.findOne().lean();
    const promoCodes = settings?.pricingSettings?.promoCodes || [];
    const normalizedCode = promoCode.trim().toUpperCase();
    const promo = promoCodes.find(
      (p: any) => p.code.toUpperCase() === normalizedCode,
    );

    if (!promo || !promo.isActive) {
      return errorResponse("Promo code is no longer valid", 400);
    }

    // Check expiry
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return errorResponse("Promo code has expired", 400);
    }

    // Check per-user limit
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

    // Check global limit
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

    // Recalculate discount securely on the server
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

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "dummy_key_for_build",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret_for_build",
  });

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100), // Razorpay expects amount in paise
    currency: "INR",
    receipt: `order_${Date.now()}`,
    notes: {
      customerName,
      email,
    },
  });

  // Store pending order details in Redis for up to 30 minutes
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken || redisUrl.startsWith("your_")) {
    return errorResponse("Redis is not configured for pending orders", 500);
  }

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const orderData = {
    userId,
    items: items.map((item: any) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      priceAtPurchase: item.price,
      image:
        typeof item.image === "string" ? item.image : item.image?.url || "",
      selectedSize: item.size,
      selectedColor: item.color,
    })),
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
  await redis.set(`pending_order_${razorpayOrder.id}`, orderData, { ex: 1800 });

  // If the user checked "Save this address", update their profile
  if (saveAddress) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        shippingAddress: {
          ...shippingAddress,
          country: shippingAddress.country || "India",
        },
        // Only update name and phone if they are missing or if you want to override them
        // Let's assume we update them if provided
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
  });
});

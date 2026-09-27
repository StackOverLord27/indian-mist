export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { Order } from "@/models/order.model";

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  const body = await req.json();
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return errorResponse("Missing payment details", 400);
  }

  // Verify Razorpay signature
  const generatedSignature = createHmac(
    "sha256",
    process.env.RAZORPAY_KEY_SECRET!
  )
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    return errorResponse("Payment verification failed", 400);
  }

  // Payment is verified. Fetch pending order from Redis.
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken || redisUrl.startsWith("your_")) {
    return errorResponse("Redis is not configured", 500);
  }

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: redisUrl, token: redisToken });
  
  const pendingOrderStr = await redis.get(`pending_order_${razorpayOrderId}`);
  
  if (!pendingOrderStr) {
    return errorResponse("Order session expired or not found. If you were charged, contact support.", 404);
  }
  
  const pendingOrder = typeof pendingOrderStr === "string" 
    ? JSON.parse(pendingOrderStr) 
    : pendingOrderStr;

  // Create the actual order in DB now that payment succeeded
  const order = await Order.create({
    ...pendingOrder,
    status: "PROCESSING",
    paymentStatus: "PAID",
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  // Cleanup Redis: pending order and promo lock
  await redis.del(`pending_order_${razorpayOrderId}`);

  // Clear the promo code lock so it doesn't linger
  if (pendingOrder.promoCode && pendingOrder.userId) {
    const promoLockKey = `promo_lock_${pendingOrder.userId}_${pendingOrder.promoCode.toUpperCase()}`;
    await redis.del(promoLockKey);
  }

  return successResponse({
    message: "Payment verified successfully",
    orderId: order._id,
    status: order.status,
    paymentStatus: order.paymentStatus,
  });
});

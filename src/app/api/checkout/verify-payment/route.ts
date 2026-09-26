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
    // Mark order as FAILED
    await Order.findOneAndUpdate(
      { razorpayOrderId },
      { paymentStatus: "FAILED" }
    );
    return errorResponse("Payment verification failed", 400);
  }

  // Update order to PAID
  const order = await Order.findOneAndUpdate(
    { razorpayOrderId, userId },
    {
      paymentStatus: "PAID",
      status: "PROCESSING",
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true }
  );

  if (!order) {
    return errorResponse("Order not found", 404);
  }

  return successResponse({
    message: "Payment verified successfully",
    orderId: order._id,
    status: order.status,
    paymentStatus: order.paymentStatus,
  });
});

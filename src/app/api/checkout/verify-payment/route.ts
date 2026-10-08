export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { finalizeOrder } from "@/lib/finalize-order";

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  const body = await req.json();
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return errorResponse("Missing payment details", 400);
  }

  // Verify Razorpay signature
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const given = Buffer.from(String(razorpaySignature));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return errorResponse("Payment verification failed", 400);
  }

  const result = await finalizeOrder({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    userId,
  });

  if (!result.ok) return errorResponse(result.message, result.status);

  return successResponse({
    message: "Payment verified successfully",
    orderId: result.order._id,
    status: result.order.status,
    paymentStatus: result.order.paymentStatus,
  });
});

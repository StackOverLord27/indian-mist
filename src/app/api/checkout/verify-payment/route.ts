export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { finalizeOrder } from "@/lib/finalize-order";
import { getRazorpayKeySecret } from "@/lib/env";
import { isValidPaymentSignature } from "@/lib/razorpay-signature";

// Razorpay ids look like order_XXXX / pay_XXXX; only the type and a sane size are enforced here,
// the signature check below is what proves they are genuine.
const BodySchema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(64),
  razorpayPaymentId: z.string().trim().min(1).max(64),
  razorpaySignature: z.string().trim().min(1).max(256),
});

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Missing payment details", 400);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  if (!isValidPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, getRazorpayKeySecret())) {
    return errorResponse("Payment verification failed", 400);
  }

  // finalizeOrder also checks the order belongs to this signed-in user (403 otherwise)
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

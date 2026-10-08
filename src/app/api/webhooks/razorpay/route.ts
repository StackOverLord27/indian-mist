export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import dbConnect from "@/lib/db";
import { finalizeOrder } from "@/lib/finalize-order";

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

// Razorpay calls this when a payment succeeds, even if the customer closed the
// browser before the checkout page could confirm it.
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not set");
    return Response.json({ message: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return Response.json({ message: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ message: "Invalid payload" }, { status: 400 });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return Response.json({ received: true, ignored: event.event });
  }

  const payment = event.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id ?? event.payload?.order?.entity?.id;
  const razorpayPaymentId = payment?.id;
  if (!razorpayOrderId || !razorpayPaymentId) {
    return Response.json({ received: true, ignored: "missing ids" });
  }

  try {
    await dbConnect();
    const result = await finalizeOrder({ razorpayOrderId, razorpayPaymentId });
    if (!result.ok && result.status >= 500) {
      return Response.json({ message: result.message }, { status: 500 });
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[razorpay webhook] failed:", error);
    // A 500 makes Razorpay retry later
    return Response.json({ message: "Failed" }, { status: 500 });
  }
}

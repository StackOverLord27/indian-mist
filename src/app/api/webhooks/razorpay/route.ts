export const runtime = "nodejs";

import { NextRequest } from "next/server";
import dbConnect from "@/lib/db";
import { finalizeOrder } from "@/lib/finalize-order";
import { isValidWebhookSignature } from "@/lib/razorpay-signature";
import { getRazorpayWebhookSecret } from "@/lib/env";

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
  // Read through the env module like every other secret (trimmed, blank counts as missing); a
  // secret pasted with a trailing space or newline would otherwise reject every genuine webhook
  let secret: string;
  try {
    secret = getRazorpayWebhookSecret();
  } catch (error) {
    console.error("[razorpay webhook]", error instanceof Error ? error.message : "webhook secret is not configured");
    return Response.json({ message: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!isValidWebhookSignature(rawBody, signature, secret)) {
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

  // payment.captured and order.paid both carry the payment; either may arrive first, or both,
  // or the same one again: finalizeOrder makes the repeats harmless.
  const payment = event.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id ?? event.payload?.order?.entity?.id;
  const razorpayPaymentId = payment?.id;
  if (
    typeof razorpayOrderId !== "string" || !razorpayOrderId || razorpayOrderId.length > 64 ||
    typeof razorpayPaymentId !== "string" || !razorpayPaymentId || razorpayPaymentId.length > 64
  ) {
    return Response.json({ received: true, ignored: "missing ids" });
  }

  try {
    await dbConnect();
    const result = await finalizeOrder({ razorpayOrderId, razorpayPaymentId });
    if (!result.ok && result.status >= 500) {
      return Response.json({ message: result.message }, { status: 500 });
    }
    if (!result.ok) {
      // Retrying cannot help (for example the pending order is gone), so answer 200, but say so loudly
      console.error(`[razorpay webhook] could not create the order for ${razorpayOrderId}: ${result.message}`);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[razorpay webhook] failed:", error);
    // A 500 makes Razorpay retry later
    return Response.json({ message: "Failed" }, { status: 500 });
  }
}

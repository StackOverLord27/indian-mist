import { createHmac, timingSafeEqual } from "crypto";

/** Constant-time comparison of a hex HMAC with what we expect. A wrong length is simply "no". */
function sameHmac(expectedHex: string, given: string): boolean {
  const wanted = Buffer.from(expectedHex);
  const got = Buffer.from(given);
  return got.length === wanted.length && timingSafeEqual(got, wanted);
}

/** The checkout signature Razorpay returns after a payment: HMAC-SHA256("orderId|paymentId", key secret). */
export function isValidPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  return sameHmac(createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

/** The webhook signature: HMAC-SHA256(raw request body, webhook secret). */
export function isValidWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return sameHmac(createHmac("sha256", webhookSecret).update(rawBody).digest("hex"), signature);
}

import { vi } from "vitest";
import crypto from "node:crypto";

/** Unit-test mock of the `razorpay` SDK default export. */
export const razorpayState = {
  orders: [] as Record<string, unknown>[],
  payments: new Map<string, Record<string, unknown>>(),
  refunds: [] as { paymentId: string; opts?: unknown }[],
  failNextOrderCreate: false,
  reset() {
    this.orders = [];
    this.payments.clear();
    this.refunds = [];
    this.failNextOrderCreate = false;
  },
};

export function razorpayModuleMock() {
  class Razorpay {
    constructor(public cfg: { key_id: string; key_secret: string }) {}
    orders = {
      create: vi.fn(async (params: Record<string, unknown>) => {
        if (razorpayState.failNextOrderCreate) {
          razorpayState.failNextOrderCreate = false;
          throw new Error("mock razorpay failure");
        }
        const order = { id: `order_mock${razorpayState.orders.length + 1}`, status: "created", ...params };
        razorpayState.orders.push(order);
        return order;
      }),
      fetch: vi.fn(async (id: string) => razorpayState.orders.find((o) => o.id === id)),
    };
    payments = {
      fetch: vi.fn(async (id: string) => razorpayState.payments.get(id)),
      refund: vi.fn(async (paymentId: string, opts?: unknown) => {
        razorpayState.refunds.push({ paymentId, opts });
        return { id: `rfnd_mock${razorpayState.refunds.length}`, payment_id: paymentId };
      }),
    };
  }
  return { default: Razorpay };
}

/** Razorpay checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function signPayment(orderId: string, paymentId: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}
/** Webhook signature: HMAC-SHA256(rawBody, webhook_secret). */
export function signWebhook(rawBody: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * For integration scripts / browser tests that call real Razorpay TEST MODE.
 * Reads process.env (loads .env read-only if the keys are absent) and REFUSES
 * anything that is not an rzp_test_ key. Never logs secret values.
 */
export function getRazorpayTestKeys(): { keyId: string; keySecret: string; webhookSecret?: string } {
  if (!process.env.RAZORPAY_KEY_ID) {
    try { process.loadEnvFile(".env"); } catch { /* no .env: fall through to the error below */ }
  }
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  for (const [name, v] of [["RAZORPAY_KEY_ID", keyId], ["NEXT_PUBLIC_RAZORPAY_KEY_ID", publicKeyId]] as const) {
    if (v && !v.startsWith("rzp_test_")) {
      throw new Error(`Refusing to run: ${name} does not start with rzp_test_ (prefix: ${v.split("_").slice(0, 2).join("_")}). Remove any live key from the local env.`);
    }
  }
  if (!keyId || !keySecret) throw new Error("Razorpay test keys are not set (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET };
}

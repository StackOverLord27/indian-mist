import { describe, expect, it } from "vitest";
import Razorpay from "razorpay";
import { getRazorpayTestKeys, signPayment, signWebhook } from "../helpers/razorpay";
import crypto from "node:crypto";

// Real Razorpay TEST MODE (rzp_test_ enforced by getRazorpayTestKeys).
describe("razorpay test mode (live)", () => {
  const { keyId, keySecret, webhookSecret } = getRazorpayTestKeys();
  const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });

  it("creates and fetches a real test order", async () => {
    const order = await rz.orders.create({ amount: 10000, currency: "INR", receipt: `im_test_${Date.now()}` });
    expect(order.id).toMatch(/^order_/);
    expect(order.status).toBe("created");
    const fetched = await rz.orders.fetch(order.id);
    expect(fetched.amount).toBe(10000);
  });

  it("signature helpers match Razorpay's documented HMAC scheme", () => {
    const sig = signPayment("order_X", "pay_Y", keySecret);
    const expected = crypto.createHmac("sha256", keySecret).update("order_X|pay_Y").digest("hex");
    expect(sig).toBe(expected);
    if (webhookSecret) expect(signWebhook("{}", webhookSecret)).toHaveLength(64);
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState, signPayment, signWebhook } from "./helpers/razorpay";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());

import { Product } from "@/models/product.model";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import { StockReservation } from "@/models/stock-reservation.model";
import { finalizeOrder } from "@/lib/finalize-order";
import { settleOrderStock } from "@/lib/stock-reservation";
import { orderIdForRazorpayOrder } from "@/lib/order-id";
import { reviewNoteForDisplay, samePaymentText } from "@/lib/duplicate-note";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as verifyPayment from "@/app/api/checkout/verify-payment/route";
import * as webhook from "@/app/api/webhooks/razorpay/route";

setupTestDb();

const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
const KEY_SECRET = "unit-secret";
const WEBHOOK_SECRET = "unit-webhook-secret";
let n = 0;
let user: string;
let logs: string[];

const newProduct = (stock = 1000) => {
  n++;
  return Product.create({
    name: `P${n}`, slug: `dup-${n}`, description: "d", category: "tees", price: 500,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: stock,
  });
};
const stockOf = async (id: unknown) => (await Product.findById(id))!.stockQuantity as number;

const freshUser = async () => {
  user = String((await User.create({ name: "A", email: `a${Date.now()}${Math.random()}@x.test`, password: "x", isVerified: true }))._id);
};

/** A checkout that is ready to be paid: the pending order is in Redis and the stock is held. */
async function checkout(productId: string, quantity = 2) {
  const res = await createOrder.POST(new NextRequest("http://localhost/api/checkout/create-order", {
    method: "POST",
    headers: { "x-user-id": user, "content-type": "application/json" },
    body: JSON.stringify({ items: [{ productId, quantity }], customerName: "Test Buyer", email: "buyer@example.test", phone: "9999999999", shippingAddress: ADDRESS }),
  }), { params: Promise.resolve({}) });
  expect(res.status).toBe(200);
  return (await res.json()).razorpayOrderId as string;
}

const viaBrowser = (razorpayOrderId: string, paymentId: string) =>
  verifyPayment.POST(new NextRequest("http://localhost/api/checkout/verify-payment", {
    method: "POST",
    headers: { "x-user-id": user, "content-type": "application/json" },
    body: JSON.stringify({ razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signPayment(razorpayOrderId, paymentId, KEY_SECRET) }),
  }), { params: Promise.resolve({}) });

const viaWebhook = (razorpayOrderId: string, paymentId: string, event = "payment.captured") => {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount: 100000 } } } });
  return webhook.POST(new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST", headers: { "x-razorpay-signature": signWebhook(body, WEBHOOK_SECRET) }, body,
  }));
};

beforeEach(async () => {
  fakeRedis.reset();
  razorpayState.reset();
  logs = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void logs.push(a.join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => void logs.push(a.join(" ")));
  vi.spyOn(console, "log").mockImplementation((...a) => void logs.push(a.join(" ")));
  user = String((await User.create({ name: "A", email: `a${Date.now()}${Math.random()}@x.test`, password: "x", isVerified: true }))._id);
});
afterEach(() => vi.restoreAllMocks());

// The three states the unique index can be in: absent, a PLAIN index of the same name (what the live
// database had, and what stops Mongoose from building the unique one), and the declared unique one.
type IndexState = "plain index (like the live database)" | "no index" | "unique sparse index (declared)";
const setIndex = async (state: IndexState) => {
  const col = Order.collection;
  await col.dropIndex("razorpayOrderId_1").catch(() => {});
  if (state.startsWith("plain")) await col.createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1" });
  if (state.startsWith("unique")) await col.createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1", unique: true, sparse: true });
};

describe.each<[IndexState, number]>([
  ["plain index (like the live database)", 50],
  ["no index", 50],
  ["unique sparse index (declared)", 25],
])("confirmation and webhook arriving together, with a %s", (state, iterations) => {
  beforeAll(async () => { await setIndex(state); });

  it(`${iterations} rounds: exactly one order and one stock deduction every time`, async () => {
    const p = await newProduct();
    for (let i = 0; i < iterations; i++) {
      fakeRedis.reset(); // the per-address checkout limits are not what is tested here
      await freshUser(); // a new shopper each round (the same shopper paying for the same items twice is flagged on purpose)
      const before = await stockOf(p._id);
      const razorpayOrderId = await checkout(String(p._id), 2);
      expect(await stockOf(p._id)).toBe(before - 2); // held
      const paymentId = `pay_${i}_${Math.random().toString(36).slice(2, 8)}`;

      // browser + webhooks (captured and order.paid) + two direct calls, all at the same moment
      const results = await Promise.all([
        viaBrowser(razorpayOrderId, paymentId),
        viaWebhook(razorpayOrderId, paymentId),
        viaWebhook(razorpayOrderId, paymentId, "order.paid"),
        finalizeOrder({ razorpayOrderId, razorpayPaymentId: paymentId, userId: user, source: "verify-payment" }),
        finalizeOrder({ razorpayOrderId, razorpayPaymentId: paymentId, source: "webhook" }),
      ]);
      for (const r of results.slice(0, 3)) expect((r as Response).status, `round ${i}`).toBe(200);

      const orders = await Order.find({ razorpayOrderId });
      expect(orders, `round ${i}: orders`).toHaveLength(1);
      expect(String(orders[0]._id)).toBe(String(orderIdForRazorpayOrder(razorpayOrderId)));
      expect(orders[0]).toMatchObject({ stockSettled: true, paymentStatus: "PAID", razorpayPaymentId: paymentId });
      expect(["verify-payment", "webhook"]).toContain(orders[0].finalizedVia);
      expect(orders[0].finalizedAt).toBeInstanceOf(Date);
      expect(await stockOf(p._id), `round ${i}: stock`).toBe(before - 2);
      expect(orders[0].items[0].deductedQuantity).toBe(2);
      expect(orders[0].reviewNote ?? "").toBe(""); // no duplicate note either
    }
    expect(await Order.countDocuments({})).toBe(iterations);
  }, 120_000);

  it("the same without a stock hold (it expired): the stock is still taken exactly once", async () => {
    const p = await newProduct();
    for (let i = 0; i < Math.min(iterations, 20); i++) {
      fakeRedis.reset();
      await freshUser();
      const before = await stockOf(p._id);
      const razorpayOrderId = await checkout(String(p._id), 3);
      // the hold ran out and its units went back on sale
      await StockReservation.deleteMany({ razorpayOrderId });
      await Product.updateOne({ _id: p._id }, { $inc: { stockQuantity: 3 } });
      expect(await stockOf(p._id)).toBe(before);

      const paymentId = `pay_nohold_${i}`;
      await Promise.all([
        viaBrowser(razorpayOrderId, paymentId), viaWebhook(razorpayOrderId, paymentId), viaWebhook(razorpayOrderId, paymentId, "order.paid"),
        finalizeOrder({ razorpayOrderId, razorpayPaymentId: paymentId, source: "webhook" }),
      ]);
      expect(await Order.countDocuments({ razorpayOrderId }), `round ${i}`).toBe(1);
      expect(await stockOf(p._id), `round ${i}: stock`).toBe(before - 3);
    }
  }, 120_000);

  it("two different payments at the same moment do not interfere", async () => {
    const p = await newProduct();
    const ids = await Promise.all([checkout(String(p._id), 1), checkout(String(p._id), 1), checkout(String(p._id), 1)]);
    await Promise.all(ids.flatMap((id, k) => [viaBrowser(id, `pay_multi_${k}`), viaWebhook(id, `pay_multi_${k}`)]));
    for (const id of ids) expect(await Order.countDocuments({ razorpayOrderId: id })).toBe(1);
    expect(await Order.countDocuments({})).toBe(3);
  });
});

describe("how the order is recorded", () => {
  beforeAll(async () => { await setIndex("plain index (like the live database)"); });

  it("saves the path and the time on the order, and says so in the log line (no personal data)", async () => {
    const p = await newProduct();
    const viaHook = await checkout(String(p._id));
    expect((await viaWebhook(viaHook, "pay_hook")).status).toBe(200);
    const viaBrow = await checkout(String(p._id));
    expect((await viaBrowser(viaBrow, "pay_brow")).status).toBe(200);

    const a = (await Order.findOne({ razorpayOrderId: viaHook }))!;
    const b = (await Order.findOne({ razorpayOrderId: viaBrow }))!;
    expect(a.finalizedVia).toBe("webhook");
    expect(b.finalizedVia).toBe("verify-payment");
    expect(Math.abs(a.finalizedAt!.getTime() - Date.now())).toBeLessThan(10_000);

    const line = logs.find((l) => l.startsWith("[order] created") && l.includes(viaHook))!;
    expect(line).toMatch(/via webhook at \d{4}-\d\d-\d\dT/);
    expect(line).toContain("pay_hook");
    expect(logs.join("\n")).not.toContain("buyer@example.test");
  });

  it("the second confirmation is logged as such and returns the SAME order", async () => {
    const p = await newProduct();
    const id = await checkout(String(p._id));
    const first = await viaWebhook(id, "pay_x");
    expect(first.status).toBe(200);
    const second = await viaBrowser(id, "pay_x");
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(String(body.orderId)).toBe(String(orderIdForRazorpayOrder(id)));
    expect(await Order.countDocuments({ razorpayOrderId: id })).toBe(1);
  });

  it("the customer's own order list never carries the internal path/time fields", async () => {
    const profile = await import("@/app/api/profile/route");
    const p = await newProduct();
    const id = await checkout(String(p._id));
    await viaBrowser(id, "pay_profile");
    const res = await profile.GET(new NextRequest("http://localhost/api/profile", { headers: { "x-user-id": user } }), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).not.toHaveProperty("finalizedVia");
    expect(body.orders[0]).not.toHaveProperty("finalizedAt");
  });
});

describe("older duplicates (two orders for one Razorpay order, from before this fix) can never take stock twice", () => {
  beforeAll(async () => { await setIndex("plain index (like the live database)"); });

  async function legacyPair() {
    const p = await newProduct(100);
    const razorpayOrderId = `order_legacy_${Math.random().toString(36).slice(2, 8)}`;
    const base = {
      userId: user, status: "PROCESSING", paymentStatus: "PAID", stockSettled: false, razorpayOrderId, razorpayPaymentId: "pay_legacy",
      totalAmount: 1000, customerName: "A", email: "a@x.test", phone: "9999999999",
      shippingAddress: { ...ADDRESS, country: "India" },
      items: [{ productId: p._id, name: p.name, quantity: 2, priceAtPurchase: 500 }],
    };
    const [a, b] = (await Order.create([{ ...base }, { ...base }] as never[])) as unknown as { _id: mongoose.Types.ObjectId }[]; // plain index lets both in
    return { p, a, b, razorpayOrderId };
  }

  it("settling both at the same moment takes the stock once (20 rounds)", async () => {
    for (let i = 0; i < 20; i++) {
      const { p, a, b } = await legacyPair();
      await Promise.all([settleOrderStock(a._id), settleOrderStock(b._id), settleOrderStock(a._id), settleOrderStock(b._id)]);
      expect(await stockOf(p._id), `round ${i}`).toBe(98);
      const [ra, rb] = await Promise.all([Order.findById(a._id), Order.findById(b._id)]);
      expect(ra!.stockSettled && rb!.stockSettled).toBe(true);
      const deducted = [ra, rb].map((o) => o!.items[0].deductedQuantity);
      expect(deducted.sort()).toEqual([0, 2]);
      const loser = [ra!, rb!].find((o) => o.items[0].deductedQuantity === 0)!;
      expect(loser.reviewNote).toMatch(/No stock was taken for this order/);
    }
  }, 120_000);

  it("settling one after the other takes the stock once", async () => {
    const { p, a, b } = await legacyPair();
    await settleOrderStock(a._id);
    await settleOrderStock(b._id);
    expect(await stockOf(p._id)).toBe(98);
  });

  it("finalizeOrder on an old duplicate pair repairs without creating a third order or touching stock again", async () => {
    const { p, a, razorpayOrderId } = await legacyPair();
    await settleOrderStock(a._id);
    const res = await finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_legacy", source: "webhook" });
    expect(res.ok && res.alreadyProcessed).toBe(true);
    expect(await Order.countDocuments({ razorpayOrderId })).toBe(2);
    expect(await stockOf(p._id)).toBe(98);
  });
});

describe("the admin's note about duplicates", () => {
  it("same payment id on another order: says plainly it was recorded twice and must not be shipped twice", async () => {
    const p = await newProduct();
    const first = await checkout(String(p._id));
    await viaBrowser(first, "pay_same");
    const second = await checkout(String(p._id)); // a different Razorpay order carrying the same payment id (older duplicates look like this)
    await viaWebhook(second, "pay_same");
    const orders = await Order.find({ razorpayPaymentId: "pay_same" }).sort({ createdAt: 1 });
    expect(orders).toHaveLength(2);
    expect(orders[1].reviewNote).toMatch(/The same payment was recorded twice/);
    expect(orders[1].reviewNote).toMatch(/Ship only ONE/);
    expect(orders[1].reviewNote).not.toMatch(/Possible duplicate payment/);
  });

  it("a different payment for the same items keeps the existing possible-duplicate wording", async () => {
    const p = await newProduct();
    const first = await checkout(String(p._id));
    await viaBrowser(first, "pay_one");
    const second = await checkout(String(p._id));
    await viaBrowser(second, "pay_two");
    const orders = await Order.find({}).sort({ createdAt: 1 });
    expect(orders[1].reviewNote).toMatch(/^Possible duplicate payment: the same account paid for the same items in order #[0-9A-F]{6} less than 30 minutes earlier/);
    expect(orders[1].reviewNote).not.toMatch(/recorded twice/);
  });

  it("display: an old 'possible duplicate' note on a same-payment pair is replaced by the plain message", () => {
    const old = "Possible duplicate payment: the same account paid for the same items in order #ABC123 less than 30 minutes earlier. Check with the customer before shipping both; refund one in Razorpay if it is a mistake. Amount mismatch: Razorpay reports ₹1.00 paid.";
    const shown = reviewNoteForDisplay(old, ["aaaaaaaaaaaaaaaaaaABC123"]);
    expect(shown).toBe(`${samePaymentText(["aaaaaaaaaaaaaaaaaaABC123"])} Amount mismatch: Razorpay reports ₹1.00 paid.`);
    expect(reviewNoteForDisplay(old, undefined)).toBe(old.trim());
    expect(reviewNoteForDisplay(undefined, ["x"])).toBe(samePaymentText(["x"]));
    // saved twice-over: no repeat
    expect(reviewNoteForDisplay(shown, ["aaaaaaaaaaaaaaaaaaABC123"])).toBe(shown);
  });
});

void mongoose;

describe("a late confirmation that finds the pending order already gone", () => {
  beforeAll(async () => { await setIndex("plain index (like the live database)"); });

  it("returns the order the other path created: no 404 and NO false 'payment without an order' record", async () => {
    const p = await newProduct();
    const razorpayOrderId = await checkout(String(p._id));
    // The winner finishes completely (order saved, pending copy removed, unmatched record resolved)...
    expect((await viaWebhook(razorpayOrderId, "pay_late")).status).toBe(200);
    expect(await fakeRedis.get(`pending_order_${razorpayOrderId}`)).toBeNull();
    // ...but the loser's FIRST look at the orders (before the winner saved) saw nothing.
    const real = Order.findOne.bind(Order);
    let calls = 0;
    const spy = vi.spyOn(Order, "findOne").mockImplementation(((...args: Parameters<typeof real>) =>
      (++calls === 1 ? Promise.resolve(null) : real(...args))) as never);
    const res = await viaBrowser(razorpayOrderId, "pay_late");
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect((await res.json()).orderId).toBe(String(orderIdForRazorpayOrder(razorpayOrderId)));
    const { UnmatchedPayment } = await import("@/models/unmatched-payment.model");
    expect(await UnmatchedPayment.countDocuments({})).toBe(0);
    expect(await Order.countDocuments({ razorpayOrderId })).toBe(1);
  });

  it("a payment with neither an order nor a pending copy is still recorded as unmatched", async () => {
    const res = await viaWebhook("order_never_existed", "pay_nothing");
    expect(res.status).toBe(200);
    const { UnmatchedPayment } = await import("@/models/unmatched-payment.model");
    expect(await UnmatchedPayment.countDocuments({ razorpayOrderId: "order_never_existed" })).toBe(1);
  });
});

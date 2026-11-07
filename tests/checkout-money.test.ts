import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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
import Settings from "@/models/settings.model";
import { StockReservation } from "@/models/stock-reservation.model";
import {
  reserveStock,
  releaseReservation,
  releaseExpiredReservations,
  sweepExpiredReservations,
  resetSweepThrottleForTests,
  HOLD_MINUTES,
  consumeHold,
  settleOrderStock,
  PENDING_ORDER_TTL_SECONDS,
} from "@/lib/stock-reservation";
import { finalizeOrder } from "@/lib/finalize-order";
import { isValidPaymentSignature, isValidWebhookSignature } from "@/lib/razorpay-signature";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as verifyPayment from "@/app/api/checkout/verify-payment/route";
import * as release from "@/app/api/checkout/release/route";
import * as webhook from "@/app/api/webhooks/razorpay/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import * as cart from "@/app/api/products/cart/route";

setupTestDb();

const KEY_SECRET = "unit-secret";
const WEBHOOK_SECRET = "unit-webhook-secret";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
function call(h: Handler, opts: { url?: string; method?: string; json?: unknown; raw?: string; userId?: string | null; role?: string; headers?: Record<string, string>; params?: Record<string, string> } = {}) {
  const headers = new Headers(opts.headers);
  if (opts.userId !== null) headers.set("x-user-id", opts.userId ?? "");
  if (opts.role) headers.set("x-user-role", opts.role);
  let body: string | undefined;
  if (opts.json !== undefined) { body = JSON.stringify(opts.json); headers.set("content-type", "application/json"); }
  if (opts.raw !== undefined) body = opts.raw;
  return h(new NextRequest(`http://localhost${opts.url ?? "/api/test"}`, { method: opts.method ?? "POST", headers, body }), { params: Promise.resolve(opts.params ?? {}) });
}

const oid = () => new mongoose.Types.ObjectId();
const U1 = String(oid());
const U2 = String(oid());

let n = 0;
async function product(over: Record<string, unknown> = {}) {
  n++;
  return Product.create({
    name: `P${n}`, slug: `p-${n}`, description: "d", category: "tees", price: 500,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: 5, ...over,
  });
}
const stockOf = async (p: { _id: unknown }) => (await Product.findById(p._id).lean())!;

const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
function checkoutBody(items: { productId: string; quantity?: number; size?: string }[], extra: Record<string, unknown> = {}) {
  return {
    items: items.map((i) => ({ quantity: 1, ...i })),
    customerName: "Test Buyer", email: "buyer@example.test", phone: "9999999999", shippingAddress: ADDRESS, ...extra,
  };
}
async function startCheckout(userId: string, items: Parameters<typeof checkoutBody>[0], extra: Record<string, unknown> = {}) {
  const res = await call(createOrder.POST, { userId, json: checkoutBody(items, extra) });
  const body = await res.json();
  return { res, body, razorpayOrderId: body.razorpayOrderId as string };
}
async function pay(userId: string, razorpayOrderId: string, paymentId = `pay_${razorpayOrderId}`) {
  return finalizeOrder({ razorpayOrderId, razorpayPaymentId: paymentId, userId });
}
async function backdateHold(razorpayOrderId: string, minutesAgo = 1) {
  await StockReservation.updateOne({ razorpayOrderId }, { expiresAt: new Date(Date.now() - minutesAgo * 60_000) });
}
async function setPromos(promos: Record<string, unknown>[]) {
  await Settings.deleteMany({});
  await Settings.create({ pricingSettings: { promoCodes: promos } });
}

beforeEach(() => {
  fakeRedis.reset();
  razorpayState.reset();
  resetSweepThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ─── reserveStock ───────────────────────────────────────────────────────────────
describe("reserveStock", () => {
  it("never oversells under parallel attempts", async () => {
    const p = await product({ stockQuantity: 5 });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => reserveStock(U1, [{ productId: String(p._id), quantity: 1 }])),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect((await stockOf(p)).stockQuantity).toBe(0);
    expect(await StockReservation.countDocuments({ status: "ACTIVE" })).toBe(5);
  });

  it("parallel multi-unit requests: total taken never exceeds stock", async () => {
    const p = await product({ stockQuantity: 7 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserveStock(U1, [{ productId: String(p._id), quantity: 2 }])),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3); // 3 x 2 = 6 of 7
    expect((await stockOf(p)).stockQuantity).toBe(1);
  });

  it("carts with the same items in opposite order never falsely fail", async () => {
    for (let round = 0; round < 15; round++) {
      const a = await product({ stockQuantity: 2 });
      const b = await product({ stockQuantity: 2 });
      const [r1, r2] = await Promise.all([
        reserveStock(U1, [{ productId: String(a._id), quantity: 1 }, { productId: String(b._id), quantity: 1 }]),
        reserveStock(U2, [{ productId: String(b._id), quantity: 1 }, { productId: String(a._id), quantity: 1 }]),
      ]);
      expect(r1.ok && r2.ok).toBe(true);
      expect((await stockOf(a)).stockQuantity).toBe(0);
      expect((await stockOf(b)).stockQuantity).toBe(0);
    }
  });

  it("opposite-order carts for the last unit: exactly one wins and the loser leaves nothing taken", async () => {
    const a = await product({ stockQuantity: 1 });
    const b = await product({ stockQuantity: 1 });
    const [r1, r2] = await Promise.all([
      reserveStock(U1, [{ productId: String(a._id), quantity: 1 }, { productId: String(b._id), quantity: 1 }]),
      reserveStock(U2, [{ productId: String(b._id), quantity: 1 }, { productId: String(a._id), quantity: 1 }]),
    ]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    expect((await stockOf(a)).stockQuantity).toBe(0);
    expect((await stockOf(b)).stockQuantity).toBe(0);
    expect(await StockReservation.countDocuments()).toBe(1);
  });

  it("rolls back what was already taken when a later line cannot be satisfied", async () => {
    const ok = await product({ stockQuantity: 5 });
    const short = await product({ stockQuantity: 1 });
    const res = await reserveStock(U1, [{ productId: String(ok._id), quantity: 2 }, { productId: String(short._id), quantity: 3 }]);
    expect(res.ok).toBe(false);
    expect((res as { message: string }).message).toMatch(/Only 1 left/);
    expect((await stockOf(ok)).stockQuantity).toBe(5);
    expect((await stockOf(short)).stockQuantity).toBe(1);
    expect(await StockReservation.countDocuments()).toBe(0);
  });

  it("per-size stock: each size on its own, product total kept in step", async () => {
    const p = await product({ sizes: ["S", "M"], sizeStock: [{ size: "S", quantity: 2 }, { size: "M", quantity: 0 }], stockQuantity: 2 });
    expect((await reserveStock(U1, [{ productId: String(p._id), size: "S", quantity: 2 }])).ok).toBe(true);
    let doc = await stockOf(p);
    expect(doc.sizeStock!.find((s) => s.size === "S")!.quantity).toBe(0);
    expect(doc.stockQuantity).toBe(0);
    const again = await reserveStock(U1, [{ productId: String(p._id), size: "S", quantity: 1 }]);
    expect(again).toMatchObject({ ok: false });
    expect((again as { message: string }).message).toMatch(/out of stock/);
    expect((await reserveStock(U1, [{ productId: String(p._id), size: "M", quantity: 1 }])).ok).toBe(false);
    doc = await stockOf(p);
    expect(doc.stockQuantity).toBe(0);
  });

  it("per-size stock under parallel attempts never oversells a size", async () => {
    const p = await product({ sizes: ["S", "M"], sizeStock: [{ size: "S", quantity: 3 }, { size: "M", quantity: 3 }], stockQuantity: 6 });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveStock(U1, [{ productId: String(p._id), size: i % 2 ? "S" : "M", quantity: 1 }])),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(6);
    const doc = await stockOf(p);
    expect(doc.sizeStock!.map((s) => s.quantity)).toEqual([0, 0]);
    expect(doc.stockQuantity).toBe(0);
  });

  it("products with sizes but no per-size stock use the product total; untracked products are never limited", async () => {
    const noPerSize = await product({ sizes: ["S", "M"], stockQuantity: 2 });
    expect((await reserveStock(U1, [{ productId: String(noPerSize._id), size: "S", quantity: 2 }])).ok).toBe(true);
    expect((await reserveStock(U1, [{ productId: String(noPerSize._id), size: "M", quantity: 1 }])).ok).toBe(false);
    const untracked = await product({ trackInventory: false, stockQuantity: 0 });
    const res = await reserveStock(U1, [{ productId: String(untracked._id), quantity: 9 }]);
    expect(res).toEqual({ ok: true, reservationId: null });
  });

  it("gives the stock back if the reservation record cannot be saved", async () => {
    const p = await product({ stockQuantity: 4 });
    vi.spyOn(StockReservation, "create").mockRejectedValueOnce(new Error("db down") as never);
    await expect(reserveStock(U1, [{ productId: String(p._id), quantity: 3 }])).rejects.toThrow("db down");
    expect((await stockOf(p)).stockQuantity).toBe(4);
  });

  it("holds last 15 minutes", async () => {
    expect(HOLD_MINUTES).toBe(15);
    const p = await product();
    const res = await reserveStock(U1, [{ productId: String(p._id), quantity: 1 }]);
    const r = await StockReservation.findById((res as { reservationId: string }).reservationId);
    expect(Math.round((r!.expiresAt.getTime() - Date.now()) / 60_000)).toBe(15);
  });
});

// ─── expiry sweep, release ──────────────────────────────────────────────────────
describe("expired holds", () => {
  async function expiredHold(stock = 5, qty = 2) {
    const p = await product({ stockQuantity: stock });
    const res = await reserveStock(U1, [{ productId: String(p._id), quantity: qty }]);
    await StockReservation.updateOne({ _id: (res as { reservationId: string }).reservationId }, { expiresAt: new Date(Date.now() - 1000) });
    return p;
  }

  it("releases exactly once even when many sweeps run at the same time", async () => {
    const p = await expiredHold(5, 2);
    expect((await stockOf(p)).stockQuantity).toBe(3);
    await Promise.all([
      ...Array.from({ length: 8 }, () => releaseExpiredReservations()),
      ...Array.from({ length: 4 }, () => releaseReservation({ userId: U1 })),
    ]);
    expect((await stockOf(p)).stockQuantity).toBe(5); // not 7, not 9
    expect(await StockReservation.countDocuments({ status: "RELEASED" })).toBe(1);
  });

  it("does not touch holds that are still running", async () => {
    const p = await product({ stockQuantity: 3 });
    await reserveStock(U1, [{ productId: String(p._id), quantity: 1 }]);
    expect(await releaseExpiredReservations()).toBe(0);
    expect((await stockOf(p)).stockQuantity).toBe(2);
  });

  it("the lazy sweep runs at most once a minute per instance", async () => {
    const find = vi.spyOn(StockReservation, "find");
    await sweepExpiredReservations();
    await sweepExpiredReservations();
    await Promise.all([sweepExpiredReservations(), sweepExpiredReservations()]);
    expect(find).toHaveBeenCalledTimes(1);
    resetSweepThrottleForTests();
    await sweepExpiredReservations();
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("the lazy sweep returns the stock; concurrent callers still restore it once", async () => {
    const p = await expiredHold(5, 2);
    resetSweepThrottleForTests();
    await Promise.all(Array.from({ length: 6 }, () => sweepExpiredReservations()));
    expect((await stockOf(p)).stockQuantity).toBe(5);
  });

  it("a failing sweep never throws into the page that triggered it, and is retried next time", async () => {
    vi.spyOn(StockReservation, "find").mockImplementationOnce((() => { throw new Error("db down"); }) as never);
    await expect(sweepExpiredReservations()).resolves.toBeUndefined();
    const find = vi.spyOn(StockReservation, "find");
    await sweepExpiredReservations();
    expect(find).toHaveBeenCalled();
  });

  it("the cart check route sweeps first, so it reports the real stock", async () => {
    const p = await expiredHold(1, 1);
    expect((await stockOf(p)).stockQuantity).toBe(0);
    resetSweepThrottleForTests();
    const res = await call(cart.POST, { userId: U1, json: { items: [{ productId: String(p._id) }] } });
    const { results } = await res.json();
    expect(results[0]).toMatchObject({ available: true, maxQuantity: 1 });
  });

  it("a hold whose order already exists is consumed, not given back (process stopped before settling)", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    expect((await stockOf(p)).stockQuantity).toBe(1);
    // the paid order was saved, then the process died before the stock was settled
    const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as Record<string, unknown>;
    await Order.create({ ...pending, status: "PROCESSING", paymentStatus: "PAID", razorpayOrderId, razorpayPaymentId: "pay_x" });
    await backdateHold(razorpayOrderId);
    await releaseExpiredReservations();
    expect((await stockOf(p)).stockQuantity).toBe(1); // stays deducted
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("CONSUMED");
    // and a webhook retry afterwards changes nothing
    const again = await finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_x" });
    expect(again).toMatchObject({ ok: true, alreadyProcessed: true });
    expect((await stockOf(p)).stockQuantity).toBe(1);
  });

  it("settling a hold that the sweep already consumed does not take the stock a second time", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    expect(await consumeHold(razorpayOrderId)).toBe(true);
    expect(await consumeHold(razorpayOrderId)).toBe(false); // second time: nothing to do
    const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as Record<string, unknown>;
    const order = await Order.create({ ...pending, status: "PROCESSING", paymentStatus: "PAID", stockSettled: false, razorpayOrderId, razorpayPaymentId: "pay_x" });
    const note = await settleOrderStock(order._id);
    expect(note).toBeNull();
    expect((await stockOf(p)).stockQuantity).toBe(1); // 3 - 2, once
  });

  it("the retry itself finishes settling a hold left behind by a stopped process", async () => {
    const p = await product({ stockQuantity: 1 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as Record<string, unknown>;
    await Order.create({ ...pending, status: "PROCESSING", paymentStatus: "PAID", razorpayOrderId, razorpayPaymentId: "pay_x" });
    await finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_x" });
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("CONSUMED");
    const doc = await stockOf(p);
    expect(doc.stockQuantity).toBe(0);
    expect(doc.badge).toBe("Sold Out");
  });
});

describe("release on dismiss", () => {
  it("only the owner of the checkout can release it, and only once", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    expect((await stockOf(p)).stockQuantity).toBe(1);

    const stranger = await (await call(release.POST, { userId: U2, json: { razorpayOrderId } })).json();
    expect(stranger.released).toBe(false);
    expect((await stockOf(p)).stockQuantity).toBe(1);

    const results = await Promise.all(Array.from({ length: 4 }, () => call(release.POST, { userId: U1, json: { razorpayOrderId } }).then((r) => r.json())));
    expect(results.filter((r) => r.released)).toHaveLength(1);
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("rejects bad bodies and anonymous callers", async () => {
    expect((await call(release.POST, { userId: null, json: { razorpayOrderId: "x" } })).status).toBe(401);
    expect((await call(release.POST, { userId: U1, json: { razorpayOrderId: 5 } })).status).toBe(400);
    expect((await call(release.POST, { userId: U1, raw: "{nope" })).status).toBe(400);
  });

  it("a release after the order was paid changes nothing", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    await pay(U1, razorpayOrderId);
    const res = await (await call(release.POST, { userId: U1, json: { razorpayOrderId } })).json();
    expect(res.released).toBe(false);
    expect((await stockOf(p)).stockQuantity).toBe(1);
  });

  it("the Sold Out label set by a payment is cleared when another shopper's hold is given back", async () => {
    const p = await product({ stockQuantity: 2 });
    const a = await startCheckout(U1, [{ productId: String(p._id) }]);
    const b = await startCheckout(U2, [{ productId: String(p._id) }]);
    await pay(U1, a.razorpayOrderId);
    expect((await stockOf(p)).badge).toBe("Sold Out"); // nothing left while B's hold exists
    await call(release.POST, { userId: U2, json: { razorpayOrderId: b.razorpayOrderId } });
    const doc = await stockOf(p);
    expect(doc.stockQuantity).toBe(1);
    expect(doc.badge).toBe("");
  });
});

// ─── create-order ───────────────────────────────────────────────────────────────
describe("create-order", () => {
  it("charges whole paise, matching the stored total, and keeps the pending order 24 hours", async () => {
    expect(PENDING_ORDER_TTL_SECONDS).toBe(86400);
    const p = await product({ price: 333.33, stockQuantity: 9 });
    const { res, body, razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 3 }]);
    expect(res.status).toBe(200);
    expect(Number.isInteger(body.amount)).toBe(true);
    expect(razorpayState.orders[0]).toMatchObject({ amount: 99999, currency: "INR" }); // 999.99, free shipping at 999
    expect(body.totalAmount).toBe(999.99);
    const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as { totalAmount: number };
    expect(pending.totalAmount).toBe(999.99);
    expect(await fakeRedis.ttl(`pending_order_${razorpayOrderId}`)).toBeGreaterThan(86400 - 5);
  });

  it("gives the stock back when Razorpay fails", async () => {
    const p = await product({ stockQuantity: 3 });
    razorpayState.failNextOrderCreate = true;
    const res = await call(createOrder.POST, { userId: U1, json: checkoutBody([{ productId: String(p._id), quantity: 2 }]) });
    expect(res.status).toBe(500);
    expect((await stockOf(p)).stockQuantity).toBe(3);
    expect(await StockReservation.countDocuments({ status: "ACTIVE" })).toBe(0);
  });

  it("gives the stock back when the pending order cannot be stored", async () => {
    const p = await product({ stockQuantity: 3 });
    vi.spyOn(fakeRedis, "set").mockRejectedValueOnce(new Error("redis down"));
    const res = await call(createOrder.POST, { userId: U1, json: checkoutBody([{ productId: String(p._id), quantity: 2 }]) });
    expect(res.status).toBe(500);
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("a failure saving the profile address does not break the checkout", async () => {
    const p = await product();
    vi.spyOn(User, "findByIdAndUpdate").mockRejectedValueOnce(new Error("db hiccup") as never);
    const { res } = await startCheckout(U1, [{ productId: String(p._id) }], { saveAddress: true });
    expect(res.status).toBe(200);
    expect((await stockOf(p)).stockQuantity).toBe(4); // still held
  });

  it("a new checkout releases the same shopper's earlier unpaid hold", async () => {
    const p = await product({ stockQuantity: 2 });
    await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const second = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    expect(second.res.status).toBe(200);
    expect((await stockOf(p)).stockQuantity).toBe(0);
    expect(await StockReservation.countDocuments({ status: "ACTIVE" })).toBe(1);
  });

  it("two shoppers racing for the last unit: one gets a Razorpay order, the other a clear message", async () => {
    const p = await product({ stockQuantity: 1 });
    const [a, b] = await Promise.all([
      call(createOrder.POST, { userId: U1, json: checkoutBody([{ productId: String(p._id) }]) }),
      call(createOrder.POST, { userId: U2, json: checkoutBody([{ productId: String(p._id) }]) }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(razorpayState.orders).toHaveLength(1);
    expect((await stockOf(p)).stockQuantity).toBe(0);
  });
});

// ─── finalizeOrder ──────────────────────────────────────────────────────────────
describe("finalizeOrder", () => {
  it("browser confirmation and webhook at the same time: one order, stock settled once", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const results = await Promise.all([
      finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_1", razorpaySignature: "s", userId: U1 }),
      finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_1" }),
      finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_1", userId: U1 }),
      finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_1" }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await Order.countDocuments({ razorpayOrderId })).toBe(1);
    expect(results.filter((r) => r.ok && !r.alreadyProcessed)).toHaveLength(1);
    expect((await stockOf(p)).stockQuantity).toBe(3); // 5 - 2, once
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("CONSUMED");
    expect(await fakeRedis.get(`pending_order_${razorpayOrderId}`)).toBeNull();
  });

  it("is idempotent on replay", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    await pay(U1, razorpayOrderId);
    for (let i = 0; i < 3; i++) expect(await finalizeOrder({ razorpayOrderId, razorpayPaymentId: "pay_x" })).toMatchObject({ ok: true, alreadyProcessed: true });
    expect(await Order.countDocuments()).toBe(1);
    expect((await stockOf(p)).stockQuantity).toBe(4);
  });

  it("refuses another shopper's order", async () => {
    const p = await product();
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect(await pay(U2, razorpayOrderId)).toMatchObject({ ok: false, status: 403 });
    expect(await Order.countDocuments()).toBe(0);
    await pay(U1, razorpayOrderId);
    expect(await pay(U2, razorpayOrderId)).toMatchObject({ ok: false, status: 403 });
  });

  it("payment after the hold expired and was swept, stock still available: order made, stock re-claimed, no note", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    await backdateHold(razorpayOrderId, 20);
    await releaseExpiredReservations();
    expect((await stockOf(p)).stockQuantity).toBe(3);

    fakeRedis.advance(20 * 60_000); // 20 minutes: hold gone, pending order (24 h) still there
    const res = await pay(U1, razorpayOrderId);
    expect(res).toMatchObject({ ok: true, alreadyProcessed: false });
    expect((await stockOf(p)).stockQuantity).toBe(1);
    expect((await Order.findOne({ razorpayOrderId }))!.reviewNote).toBeUndefined();
  });

  it("payment after the hold expired and the stock is gone: the order stands with a review note", async () => {
    const p = await product({ stockQuantity: 1 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    await backdateHold(razorpayOrderId, 20);
    await releaseExpiredReservations();
    await startCheckout(U2, [{ productId: String(p._id) }]); // someone else takes the last unit
    expect((await stockOf(p)).stockQuantity).toBe(0);

    const res = await pay(U1, razorpayOrderId);
    expect(res.ok).toBe(true);
    const order = await Order.findOne({ razorpayOrderId });
    expect(order!.paymentStatus).toBe("PAID");
    expect(order!.reviewNote).toMatch(/stock ran out/);
    const doc = await stockOf(p);
    expect(doc.stockQuantity).toBe(0);
    expect(doc.badge).toBe("Sold Out");
  });

  it("payment long after the hold, before the pending order's 24 h", async () => {
    const p = await product();
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    fakeRedis.advance(23 * 3600_000);
    expect((await pay(U1, razorpayOrderId)).ok).toBe(true);
  });

  it("pending order missing after its TTL: a clear 404, no order, no stock change", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    fakeRedis.advance(25 * 3600_000);
    const res = await pay(U1, razorpayOrderId);
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(await Order.countDocuments()).toBe(0);
  });

  it("a failure while saving the order keeps the pending order, so the retry completes it", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    vi.spyOn(Order, "create").mockRejectedValueOnce(new Error("db down") as never);
    await expect(pay(U1, razorpayOrderId)).rejects.toThrow("db down");
    expect(await fakeRedis.get(`pending_order_${razorpayOrderId}`)).not.toBeNull();
    expect(await Order.countDocuments()).toBe(0);
    expect((await pay(U1, razorpayOrderId)).ok).toBe(true);
    expect(await Order.countDocuments()).toBe(1);
  });

  it("a failure while settling stock never fails a paid order", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    vi.spyOn(StockReservation, "findOneAndUpdate").mockRejectedValueOnce(new Error("db hiccup") as never);
    expect((await pay(U1, razorpayOrderId)).ok).toBe(true);
    expect(await Order.countDocuments()).toBe(1);
  });
});

// ─── promo codes ────────────────────────────────────────────────────────────────
describe("promo codes", () => {
  const code = (over: Record<string, unknown> = {}) => ({ code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10, ...over });

  it("applies case-insensitively and stores the code upper-case", async () => {
    await setPromos([code()]);
    const p = await product({ price: 1000 });
    const { res, razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "  save10 " });
    expect(res.status).toBe(200);
    expect(razorpayState.orders[0]).toMatchObject({ amount: 90000 });
    await pay(U1, razorpayOrderId);
    expect((await Order.findOne({ razorpayOrderId }))!.promoCode).toBe("SAVE10");
  });

  it("rejects unknown, inactive, expired and below-minimum codes", async () => {
    await setPromos([
      code({ code: "OFF", isActive: false }),
      code({ code: "OLD", expiresAt: new Date(Date.now() - 86400_000) }),
      code({ code: "BIG", minOrderValue: 5000 }),
    ]);
    const p = await product({ price: 1000, stockQuantity: 20 });
    for (const c of ["NOPE", "off", "OLD", "big"]) {
      const { res } = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: c });
      expect(res.status).toBe(400);
    }
    expect((await stockOf(p)).stockQuantity).toBe(20); // nothing was held
  });

  it("per-user limit counts only PAID orders: abandoned checkouts do not use the code up", async () => {
    await setPromos([code()]);
    const p = await product({ price: 1000, stockQuantity: 20 });
    for (let i = 0; i < 3; i++) {
      expect((await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "SAVE10" })).res.status).toBe(200); // never paid
    }
    const last = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "save10" });
    await pay(U1, last.razorpayOrderId);
    const again = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "Save10" });
    expect(again.res.status).toBe(400);
    expect(again.body.message).toMatch(/already used/);
    expect((await startCheckout(U2, [{ productId: String(p._id) }], { promoCode: "SAVE10" })).res.status).toBe(200); // someone else is fine
  });

  it("total limit counts only PAID orders", async () => {
    await setPromos([code({ maxUses: 2, maxUsesPerUser: 0 })]);
    const p = await product({ price: 1000, stockQuantity: 20 });
    const users = [U1, U2, String(oid())];
    const a = await startCheckout(users[0], [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    const b = await startCheckout(users[1], [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    expect((await startCheckout(users[2], [{ productId: String(p._id) }], { promoCode: "SAVE10" })).res.status).toBe(200); // 0 paid so far
    await pay(users[0], a.razorpayOrderId);
    await pay(users[1], b.razorpayOrderId);
    const c = await startCheckout(users[2], [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    expect(c.res.status).toBe(400);
    expect(c.body.message).toMatch(/usage limit/);
  });

  it("two checkouts opened together can both pass the limit; finalisation flags the second with a note", async () => {
    await setPromos([code({ maxUses: 1, maxUsesPerUser: 0 })]);
    const p = await product({ price: 1000, stockQuantity: 20 });
    const a = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    const b = await startCheckout(U2, [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    expect([a.res.status, b.res.status]).toEqual([200, 200]);
    await pay(U1, a.razorpayOrderId);
    await pay(U2, b.razorpayOrderId);
    const second = await Order.findOne({ razorpayOrderId: b.razorpayOrderId });
    expect(second!.paymentStatus).toBe("PAID"); // the customer paid, the order stands
    expect(second!.reviewNote).toMatch(/passed its total limit of 1/);
    expect((await Order.findOne({ razorpayOrderId: a.razorpayOrderId }))!.reviewNote).toBeUndefined();
  });

  it("finalisation matches a stored code in any case", async () => {
    await setPromos([code({ code: "save10", maxUsesPerUser: 1 })]); // legacy lower-case code in settings
    const p = await product({ price: 1000, stockQuantity: 20 });
    const a = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "SAVE10" });
    expect(a.res.status).toBe(200);
    await pay(U1, a.razorpayOrderId);
    expect((await Order.findOne({ razorpayOrderId: a.razorpayOrderId }))!.promoCode).toBe("SAVE10");
    const again = await startCheckout(U1, [{ productId: String(p._id) }], { promoCode: "SaVe10" });
    expect(again.res.status).toBe(400);
  });
});

// ─── cancellation ───────────────────────────────────────────────────────────────
describe("cancelling a paid order", () => {
  async function paidOrder(stock = 3, qty = 2) {
    const p = await product({ stockQuantity: stock });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: qty }]);
    const res = await pay(U1, razorpayOrderId);
    return { p, order: (res as { order: { _id: unknown } }).order };
  }
  const setStatus = (id: unknown, status: string) =>
    call(orderStatus.PATCH, { method: "PATCH", role: "admin", userId: U1, headers: { "x-user-email": "a@b.c" }, json: { status }, params: { id: String(id) } });

  it("restocks exactly once even when cancelled twice at the same time", async () => {
    const { p, order } = await paidOrder(3, 2);
    expect((await stockOf(p)).stockQuantity).toBe(1);
    const results = await Promise.all([setStatus(order._id, "CANCELLED"), setStatus(order._id, "CANCELLED"), setStatus(order._id, "CANCELLED")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await stockOf(p)).stockQuantity).toBe(3);
    expect((await setStatus(order._id, "CANCELLED")).status).toBe(409);
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("a cancelled order cannot be revived, other status changes do not restock", async () => {
    const { p, order } = await paidOrder(3, 1);
    expect((await setStatus(order._id, "SHIPPED")).status).toBe(200);
    expect((await stockOf(p)).stockQuantity).toBe(2);
    await setStatus(order._id, "CANCELLED");
    expect((await setStatus(order._id, "PROCESSING")).status).toBe(409);
  });

  it("clears the automatic Sold Out label when stock comes back", async () => {
    const { p, order } = await paidOrder(1, 1);
    expect((await stockOf(p)).badge).toBe("Sold Out");
    await setStatus(order._id, "CANCELLED");
    expect((await stockOf(p)).badge).toBe("");
  });

  it("restocks the right size", async () => {
    const p = await product({ sizes: ["S", "M"], sizeStock: [{ size: "S", quantity: 2 }, { size: "M", quantity: 2 }], stockQuantity: 4 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), size: "M", quantity: 2 }]);
    const { order } = (await pay(U1, razorpayOrderId)) as { order: { _id: unknown } };
    await setStatus(order._id, "CANCELLED");
    const doc = await stockOf(p);
    expect(doc.sizeStock!.map((s) => s.quantity)).toEqual([2, 2]);
    expect(doc.stockQuantity).toBe(4);
  });

  it("is admin only and validates ids", async () => {
    const { order } = await paidOrder();
    expect((await call(orderStatus.PATCH, { method: "PATCH", role: "user", userId: U1, headers: { "x-user-email": "a@b.c" }, json: { status: "CANCELLED" }, params: { id: String(order._id) } })).status).toBe(403);
    expect((await setStatus("nope", "CANCELLED")).status).toBe(400);
    expect((await setStatus(order._id, "BOGUS")).status).toBe(400);
    expect((await setStatus(oid(), "CANCELLED")).status).toBe(404);
  });
});

// ─── signatures, verify-payment, webhook ───────────────────────────────────────
describe("signatures", () => {
  it("payment signature: valid, wrong, wrong length, empty", () => {
    const good = signPayment("order_1", "pay_1", KEY_SECRET);
    expect(isValidPaymentSignature("order_1", "pay_1", good, KEY_SECRET)).toBe(true);
    expect(isValidPaymentSignature("order_1", "pay_1", signPayment("order_1", "pay_1", "other"), KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_2", good, KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_2", "pay_1", good, KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", good.slice(0, -2), KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", good + "00", KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", "", KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", "é".repeat(good.length), KEY_SECRET)).toBe(false); // same char count, different bytes
  });

  it("webhook signature: valid, wrong, wrong length, tampered body", () => {
    const body = '{"event":"order.paid"}';
    const good = signWebhook(body, WEBHOOK_SECRET);
    expect(isValidWebhookSignature(body, good, WEBHOOK_SECRET)).toBe(true);
    expect(isValidWebhookSignature(body + " ", good, WEBHOOK_SECRET)).toBe(false);
    expect(isValidWebhookSignature(body, signWebhook(body, "x"), WEBHOOK_SECRET)).toBe(false);
    expect(isValidWebhookSignature(body, good.slice(1), WEBHOOK_SECRET)).toBe(false);
    expect(isValidWebhookSignature(body, "", WEBHOOK_SECRET)).toBe(false);
  });
});

describe("verify-payment route", () => {
  it("creates the order for a correct signature and rejects everything else", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    const paymentId = "pay_abc";
    const bad = await call(verifyPayment.POST, { userId: U1, json: { razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signPayment(razorpayOrderId, paymentId, "wrong") } });
    expect(bad.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);

    for (const json of [{}, { razorpayOrderId: 1, razorpayPaymentId: "p", razorpaySignature: "s" }, { razorpayOrderId, razorpayPaymentId: ["x"], razorpaySignature: "s" }, { razorpayOrderId: "o".repeat(200), razorpayPaymentId: "p", razorpaySignature: "s" }, null]) {
      expect((await call(verifyPayment.POST, { userId: U1, json })).status).toBe(400);
    }
    expect((await call(verifyPayment.POST, { userId: U1, raw: "{broken" })).status).toBe(400);
    expect((await call(verifyPayment.POST, { userId: null, json: {} })).status).toBe(401);

    const good = { razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signPayment(razorpayOrderId, paymentId, KEY_SECRET) };
    expect((await call(verifyPayment.POST, { userId: U2, json: good })).status).toBe(403); // someone else's order
    expect(await Order.countDocuments()).toBe(0);
    const ok = await call(verifyPayment.POST, { userId: U1, json: good });
    expect(ok.status).toBe(200);
    expect((await ok.json()).paymentStatus).toBe("PAID");
    expect((await call(verifyPayment.POST, { userId: U1, json: good })).status).toBe(200); // replay
    expect(await Order.countDocuments()).toBe(1);
  });
});

describe("razorpay webhook", () => {
  const send = (payload: unknown, opts: { secret?: string; raw?: string; signature?: string } = {}) => {
    const raw = opts.raw ?? JSON.stringify(payload);
    return call(webhook.POST, { userId: null, raw, headers: { "x-razorpay-signature": opts.signature ?? signWebhook(raw, opts.secret ?? WEBHOOK_SECRET) } });
  };
  const captured = (orderId: string, paymentId = "pay_w1") => ({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: orderId } } } });
  const orderPaid = (orderId: string, paymentId = "pay_w1") => ({ event: "order.paid", payload: { payment: { entity: { id: paymentId, order_id: orderId } }, order: { entity: { id: orderId } } } });

  it("creates the order from payment.captured and from order.paid, once, and survives replays", async () => {
    const p = await product({ stockQuantity: 4 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const results = await Promise.all([send(captured(razorpayOrderId)), send(orderPaid(razorpayOrderId)), send(captured(razorpayOrderId))]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await Order.countDocuments()).toBe(1);
    expect((await stockOf(p)).stockQuantity).toBe(2);
    expect((await send(orderPaid(razorpayOrderId))).status).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
    expect((await stockOf(p)).stockQuantity).toBe(2);
  });

  it("a webhook secret saved with stray spaces or a newline (a common paste slip) still verifies", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", `  ${WEBHOOK_SECRET}\n`);
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect((await send(captured(razorpayOrderId))).status).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    expect((await send(captured(razorpayOrderId))).status).toBe(503); // blank counts as not configured
    vi.unstubAllEnvs();
  });

  it("order.paid works when it comes first, and the later browser confirmation reuses the order", async () => {
    const p = await product({ stockQuantity: 2 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect((await send(orderPaid(razorpayOrderId))).status).toBe(200);
    expect(await pay(U1, razorpayOrderId)).toMatchObject({ ok: true, alreadyProcessed: true });
    expect(await Order.countDocuments()).toBe(1);
  });

  it("rejects a wrong or missing signature and bad payloads", async () => {
    const p = await product();
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect((await send(captured(razorpayOrderId), { secret: "wrong" })).status).toBe(400);
    expect((await send(captured(razorpayOrderId), { signature: "" })).status).toBe(400);
    expect((await send(captured(razorpayOrderId), { signature: "abc" })).status).toBe(400);
    expect((await send(null, { raw: "{not json" })).status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("answers 200 and does nothing for unrelated events and unusable payloads", async () => {
    for (const payload of [
      { event: "payment.failed", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } },
      { event: "refund.created", payload: {} },
      {},
      { event: "payment.captured", payload: {} },
      { event: "payment.captured", payload: { payment: { entity: { id: 5, order_id: ["x"] } } } },
      { event: "payment.captured", payload: { payment: { entity: { id: "p".repeat(100), order_id: "order_1" } } } },
    ]) {
      const res = await send(payload);
      expect(res.status).toBe(200);
    }
    expect(await Order.countDocuments()).toBe(0);
  });

  it("503 when the secret is not configured (Razorpay retries)", async () => {
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
      expect((await send(captured("order_1"))).status).toBe(503);
    } finally {
      process.env.RAZORPAY_WEBHOOK_SECRET = saved;
    }
  });

  it("5xx only for failures a retry can fix", async () => {
    const p = await product();
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    vi.spyOn(Order, "create").mockRejectedValueOnce(new Error("db down") as never);
    expect((await send(captured(razorpayOrderId))).status).toBe(500);
    expect((await send(captured(razorpayOrderId))).status).toBe(200); // the retry works: the pending order was kept
    expect(await Order.countDocuments()).toBe(1);
    // pending order gone for good: retrying is pointless, so 200
    expect((await send(captured("order_unknown"))).status).toBe(200);
  });
});

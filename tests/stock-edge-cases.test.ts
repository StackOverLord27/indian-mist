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
import { StockReservation } from "@/models/stock-reservation.model";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";
import {
  releaseReservation,
  releaseExpiredReservations,
  repairUnsettledOrders,
  resetSweepThrottleForTests,
  settleOrderStock,
} from "@/lib/stock-reservation";
import { finalizeOrder } from "@/lib/finalize-order";
import { allowCheckoutStart, CHECKOUT_STARTS_PER_ACCOUNT, CHECKOUT_STARTS_PER_IP } from "@/lib/attempt-limit";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as verifyPayment from "@/app/api/checkout/verify-payment/route";
import * as webhook from "@/app/api/webhooks/razorpay/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import * as unmatchedApi from "@/app/api/admin/unmatched-payments/route";

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

const setStatus = (id: unknown, status: string) =>
  call(orderStatus.PATCH, { method: "PATCH", role: "admin", userId: U1, headers: { "x-user-email": "a@b.c" }, json: { status }, params: { id: String(id) } });

/** A paid, settled order bought through the real checkout. */
async function paidOrder(stock: number, qty: number, extra: Record<string, unknown> = {}) {
  const p = await product({ stockQuantity: stock, ...extra });
  const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: qty }]);
  const res = (await pay(U1, razorpayOrderId)) as { order: { _id: unknown } };
  return { p, razorpayOrderId, orderId: res.order._id };
}
/** The order exists and is unsettled: the process "stopped" right after saving it. */
async function unsettledOrder(p: { _id: unknown }, qty: number, buyer = U1) {
  const { razorpayOrderId } = await startCheckout(buyer, [{ productId: String(p._id), quantity: qty }]);
  const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as Record<string, unknown>;
  const order = await Order.create({
    ...pending, status: "PROCESSING", paymentStatus: "PAID", stockSettled: false,
    razorpayOrderId, razorpayPaymentId: "pay_x",
  });
  return { razorpayOrderId, order };
}
const backdateOrder = (id: unknown, minutes = 5) =>
  Order.collection.updateOne({ _id: id as never }, { $set: { createdAt: new Date(Date.now() - minutes * 60_000) } });

beforeEach(() => {
  fakeRedis.reset();
  razorpayState.reset();
  resetSweepThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ─── 1. what was really deducted is recorded, and only that is given back ──────
describe("deducted quantity", () => {
  it("is the full quantity when the hold is consumed, and cancelling gives it back", async () => {
    const { p, orderId } = await paidOrder(5, 2);
    const order = await Order.findById(orderId).lean();
    expect(order!.stockSettled).toBe(true);
    expect(order!.items[0].deductedQuantity).toBe(2);
    expect((await stockOf(p)).stockQuantity).toBe(3);
    await setStatus(orderId, "CANCELLED");
    expect((await stockOf(p)).stockQuantity).toBe(5);
  });

  it("late payment that zeroed the stock, then cancel: gives back only what was taken", async () => {
    const p = await product({ stockQuantity: 3 });
    const a = await startCheckout(U1, [{ productId: String(p._id), quantity: 3 }]);
    await backdateHold(a.razorpayOrderId);
    await releaseExpiredReservations(); // A's hold expires: 3 back on sale
    const b = await startCheckout(U2, [{ productId: String(p._id), quantity: 2 }]); // B holds 2, 1 left
    expect((await stockOf(p)).stockQuantity).toBe(1);

    const late = (await pay(U1, a.razorpayOrderId)) as { ok: true; order: { _id: unknown } };
    expect(late.ok).toBe(true);
    const lateOrder = await Order.findById(late.order._id).lean();
    expect(lateOrder!.reviewNote).toMatch(/stock ran out/);
    expect(lateOrder!.items[0].deductedQuantity).toBe(1); // ordered 3, only 1 was there
    expect((await stockOf(p)).stockQuantity).toBe(0);

    await setStatus(late.order._id, "CANCELLED");
    expect((await stockOf(p)).stockQuantity).toBe(1); // not 3: before the fix this over-restocked to 3
    // B's own order is unaffected: paying and cancelling it returns its 2
    const bOrder = (await pay(U2, b.razorpayOrderId)) as { order: { _id: unknown } };
    await setStatus(bOrder.order._id, "CANCELLED");
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("late payment with a sized product records the size's remainder", async () => {
    const p = await product({ sizes: ["S", "M"], sizeStock: [{ size: "S", quantity: 1 }, { size: "M", quantity: 3 }], stockQuantity: 4 });
    const a = await startCheckout(U1, [{ productId: String(p._id), size: "S", quantity: 1 }]);
    await backdateHold(a.razorpayOrderId);
    await releaseExpiredReservations();
    await startCheckout(U2, [{ productId: String(p._id), size: "S", quantity: 1 }]); // the only S is held again
    const late = (await pay(U1, a.razorpayOrderId)) as { order: { _id: unknown } };
    expect((await Order.findById(late.order._id).lean())!.items[0].deductedQuantity).toBe(0);
    await setStatus(late.order._id, "CANCELLED");
    const doc = await stockOf(p);
    expect(doc.sizeStock!.map((s) => s.quantity)).toEqual([0, 3]); // nothing invented
    expect(doc.stockQuantity).toBe(3);
  });

  it("orders created before this change (no record) still give back the full quantity", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const pending = (await fakeRedis.get(`pending_order_${razorpayOrderId}`)) as Record<string, unknown>;
    const legacy = await Order.create({ ...pending, status: "PROCESSING", paymentStatus: "PAID", razorpayOrderId, razorpayPaymentId: "pay_old" });
    expect(legacy.stockSettled).toBeUndefined();
    expect(legacy.items[0].deductedQuantity).toBeUndefined();
    await StockReservation.updateOne({ razorpayOrderId }, { status: "CONSUMED" });
    expect((await stockOf(p)).stockQuantity).toBe(3);
    await setStatus(legacy._id, "CANCELLED");
    expect((await stockOf(p)).stockQuantity).toBe(5);
  });

  it("a product whose stock is not tracked records 0 and restocks nothing", async () => {
    const p = await product({ trackInventory: false, stockQuantity: 0 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const res = (await pay(U1, razorpayOrderId)) as { order: { _id: unknown } };
    expect((await Order.findById(res.order._id).lean())!.items[0].deductedQuantity).toBe(0);
    await setStatus(res.order._id, "CANCELLED");
    expect((await stockOf(p)).stockQuantity).toBe(0);
  });
});

// ─── 2. no crash window loses or repeats a restock ──────────────────────────────
describe("crash between steps", () => {
  it("settling: a failure after the stock was taken rolls everything back; the repair pass then settles exactly once", async () => {
    const p = await product({ stockQuantity: 5 });
    // hold expired AND released, then the order is saved: stock must be taken at settlement
    const { razorpayOrderId, order } = await unsettledOrder(p, 2);
    await StockReservation.updateOne({ razorpayOrderId }, { status: "RELEASED" });
    await Product.updateOne({ _id: p._id }, { stockQuantity: 5 }); // the release gave the units back

    vi.spyOn(Order, "updateOne").mockRejectedValueOnce(new Error("process stopped"));
    await expect(settleOrderStock(order._id)).rejects.toThrow("process stopped");
    expect((await stockOf(p)).stockQuantity).toBe(5); // nothing half-done
    expect((await Order.findById(order._id).lean())!.stockSettled).toBe(false);
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await repairUnsettledOrders()).toBe(0); // too young: the request that made it may still be running
    await backdateOrder(order._id);
    expect(await repairUnsettledOrders()).toBe(1);
    expect((await stockOf(p)).stockQuantity).toBe(3);
    expect(await repairUnsettledOrders()).toBe(0); // second pass: nothing to do
    expect((await stockOf(p)).stockQuantity).toBe(3);
    expect((await Order.findById(order._id).lean())!.items[0].deductedQuantity).toBe(2);
  });

  it("order saved but the process stopped before settling, hold still active: the repair pass consumes it without double-deducting", async () => {
    const p = await product({ stockQuantity: 4 });
    const { razorpayOrderId, order } = await unsettledOrder(p, 3);
    expect((await stockOf(p)).stockQuantity).toBe(1);
    await backdateOrder(order._id);
    await Promise.all([repairUnsettledOrders(), repairUnsettledOrders(), settleOrderStock(order._id)]);
    expect((await stockOf(p)).stockQuantity).toBe(1);
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("CONSUMED");
  });

  it("PAID order, no hold at all, stock never settled: the repair pass takes the stock once", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId, order } = await unsettledOrder(p, 2);
    await StockReservation.deleteOne({ razorpayOrderId });
    await Product.updateOne({ _id: p._id }, { stockQuantity: 5 });
    await backdateOrder(order._id);
    await repairUnsettledOrders();
    await repairUnsettledOrders();
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("the sweep also finishes an unsettled order whose hold expired", async () => {
    const p = await product({ stockQuantity: 4 });
    const { razorpayOrderId, order } = await unsettledOrder(p, 3);
    await backdateHold(razorpayOrderId);
    await backdateOrder(order._id);
    await releaseExpiredReservations();
    expect((await stockOf(p)).stockQuantity).toBe(1);
    expect((await Order.findById(order._id).lean())!.stockSettled).toBe(true);
  });

  it("releasing: a failure while restoring leaves the hold ACTIVE; the next release restores exactly once", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    expect((await stockOf(p)).stockQuantity).toBe(3);

    const spy = vi.spyOn(Product, "updateOne").mockRejectedValueOnce(new Error("process stopped"));
    await expect(releaseReservation({ razorpayOrderId })).rejects.toThrow("process stopped");
    spy.mockRestore();
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("ACTIVE"); // not marked RELEASED
    expect((await stockOf(p)).stockQuantity).toBe(3);

    await backdateHold(razorpayOrderId);
    await releaseExpiredReservations();
    await releaseExpiredReservations();
    expect((await stockOf(p)).stockQuantity).toBe(5); // once, not twice
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("RELEASED");
  });

  it("releasing never gives back the stock of a hold whose order exists", async () => {
    const p = await product({ stockQuantity: 5 });
    const { razorpayOrderId } = await unsettledOrder(p, 2);
    expect(await releaseReservation({ razorpayOrderId })).toBe(false); // a late 'window closed' call
    expect((await stockOf(p)).stockQuantity).toBe(3);
  });

  it("cancelling: a failure while restocking leaves the order uncancelled; the retry restocks once", async () => {
    const { p, orderId } = await paidOrder(5, 2);
    const spy = vi.spyOn(Product, "updateOne").mockRejectedValueOnce(new Error("process stopped"));
    expect((await setStatus(orderId, "CANCELLED")).status).toBe(500);
    spy.mockRestore();
    expect((await Order.findById(orderId).lean())!.status).toBe("PROCESSING"); // status change rolled back
    expect((await stockOf(p)).stockQuantity).toBe(3);

    expect((await setStatus(orderId, "CANCELLED")).status).toBe(200);
    expect((await setStatus(orderId, "CANCELLED")).status).toBe(409);
    expect((await stockOf(p)).stockQuantity).toBe(5);
  });

  it("cancelling an order whose stock was never settled settles it first, so it never over- or under-restocks", async () => {
    const p = await product({ stockQuantity: 4 });
    const { order } = await unsettledOrder(p, 3);
    expect((await stockOf(p)).stockQuantity).toBe(1);
    expect((await setStatus(order._id, "CANCELLED")).status).toBe(200);
    expect((await stockOf(p)).stockQuantity).toBe(4);
    await repairUnsettledOrders();
    expect((await stockOf(p)).stockQuantity).toBe(4); // the repair never settles a cancelled order again
  });

  it("finalizeOrder: a failure while settling still returns the paid order, and the repair pass finishes it", async () => {
    const p = await product({ stockQuantity: 4 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 3 }]);
    vi.spyOn(Order, "updateOne").mockRejectedValueOnce(new Error("db hiccup"));
    const res = await pay(U1, razorpayOrderId);
    expect(res).toMatchObject({ ok: true });
    const id = (res as { order: { _id: unknown } }).order._id;
    expect((await Order.findById(id).lean())!.stockSettled).toBe(false);
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // the webhook's retry of the same payment finishes it straight away
    expect(await pay(U1, razorpayOrderId)).toMatchObject({ ok: true, alreadyProcessed: true });
    expect((await Order.findById(id).lean())!.stockSettled).toBe(true);
    expect((await stockOf(p)).stockQuantity).toBe(1);
  });
});

// ─── 3. paid without an order ─────────────────────────────────────────────────
describe("unmatched payments", () => {
  const send = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    return call(webhook.POST, { userId: null, raw, headers: { "x-razorpay-signature": signWebhook(raw, WEBHOOK_SECRET) } });
  };
  const captured = (orderId: string, paymentId: string, amount?: number) => ({
    event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: orderId, ...(amount !== undefined && { amount }) } } },
  });
  const adminList = () => call(unmatchedApi.GET, { method: "GET", role: "admin", userId: U1, headers: { "x-user-email": "a@b.c" } });

  it("the webhook records it (with the amount), still answers 200, and a repeat does not duplicate it", async () => {
    expect((await send(captured("order_gone", "pay_g1", 129900))).status).toBe(200);
    expect((await send(captured("order_gone", "pay_g1", 129900))).status).toBe(200); // a redelivery
    const rows = await UnmatchedPayment.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ razorpayOrderId: "order_gone", razorpayPaymentId: "pay_g1", amount: 1299, source: "webhook", seen: 2 });
    expect(rows[0].resolvedAt).toBeUndefined();
    expect(await Order.countDocuments()).toBe(0);
  });

  it("verify-payment records it too (source: browser) and tells the customer to contact support", async () => {
    const sig = signPayment("order_gone2", "pay_g2", KEY_SECRET);
    const res = await call(verifyPayment.POST, { userId: U1, json: { razorpayOrderId: "order_gone2", razorpayPaymentId: "pay_g2", razorpaySignature: sig } });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toMatch(/contact support/);
    expect(await UnmatchedPayment.findOne({ razorpayOrderId: "order_gone2" }).lean()).toMatchObject({ source: "verify-payment", razorpayPaymentId: "pay_g2" });
  });

  it("if the record cannot be saved the webhook answers 500, so Razorpay retries", async () => {
    vi.spyOn(UnmatchedPayment, "updateOne").mockRejectedValueOnce(new Error("db down"));
    expect((await send(captured("order_gone3", "pay_g3"))).status).toBe(500);
    expect((await send(captured("order_gone3", "pay_g3"))).status).toBe(200); // the retry records it
    expect(await UnmatchedPayment.countDocuments()).toBe(1);
  });

  it("is marked resolved automatically when the order is created later", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    const pendingKey = `pending_order_${razorpayOrderId}`;
    const pending = await fakeRedis.get(pendingKey);
    await fakeRedis.del(pendingKey); // the session is gone...
    expect((await send(captured(razorpayOrderId, "pay_late"))).status).toBe(200);
    expect(await UnmatchedPayment.countDocuments({ resolvedAt: { $exists: false } })).toBe(1);

    await fakeRedis.set(pendingKey, pending, { ex: 100 }); // ...and comes back (restored by hand / a retry that finds it)
    expect((await send(captured(razorpayOrderId, "pay_late"))).status).toBe(200);
    const row = await UnmatchedPayment.findOne({ razorpayOrderId }).lean();
    expect(row!.resolvedAt).toBeInstanceOf(Date);
    expect(String(row!.resolvedOrderId)).toBe(String((await Order.findOne({ razorpayOrderId }))!._id));
  });

  it("the admin endpoint lists only unresolved ones, with a count, and refuses non-admins", async () => {
    await send(captured("order_a", "pay_a"));
    await send(captured("order_b", "pay_b"));
    await UnmatchedPayment.updateOne({ razorpayOrderId: "order_b" }, { resolvedAt: new Date() });
    const res = await adminList();
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data ?? body;
    expect(data.count).toBe(1);
    expect(data.payments.map((r: { razorpayOrderId: string }) => r.razorpayOrderId)).toEqual(["order_a"]);
    expect((await call(unmatchedApi.GET, { method: "GET", role: "user", userId: U1, headers: { "x-user-email": "a@b.c" } })).status).toBe(403);
    expect((await call(unmatchedApi.GET, { method: "GET", userId: null })).status).toBe(401);
  });
});

// ─── payment.failed does not release anything ─────────────────────────────────
describe("payment.failed", () => {
  it("is only logged: the hold stays, so the customer can retry on the same order", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id), quantity: 2 }]);
    const raw = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_f", order_id: razorpayOrderId, error_code: "BAD_REQUEST_ERROR" } } } });
    const res = await call(webhook.POST, { userId: null, raw, headers: { "x-razorpay-signature": signWebhook(raw, WEBHOOK_SECRET) } });
    expect(res.status).toBe(200);
    expect((await StockReservation.findOne({ razorpayOrderId }))!.status).toBe("ACTIVE");
    expect((await stockOf(p)).stockQuantity).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("payment attempt failed"));
  });
});

// ─── 4. amount check ────────────────────────────────────────────────────────────
describe("webhook amount check", () => {
  const send = (orderId: string, amount?: number) => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_amt", order_id: orderId, ...(amount !== undefined && { amount }) } } } });
    return call(webhook.POST, { userId: null, raw, headers: { "x-razorpay-signature": signWebhook(raw, WEBHOOK_SECRET) } });
  };

  it("a matching amount adds no note", async () => {
    const p = await product({ price: 500, stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    const total = razorpayState.orders[0].amount as number; // paise, as Razorpay reports it
    expect((await send(razorpayOrderId, total)).status).toBe(200);
    const order = await Order.findOne({ razorpayOrderId }).lean();
    expect(order!.reviewNote).toBeUndefined();
    expect(order!.paymentStatus).toBe("PAID");
  });

  it("a different amount keeps the order PAID and adds one review note, however often the event repeats", async () => {
    const p = await product({ price: 500, stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    for (let i = 0; i < 3; i++) expect((await send(razorpayOrderId, 100)).status).toBe(200);
    const order = await Order.findOne({ razorpayOrderId }).lean();
    expect(order!.paymentStatus).toBe("PAID");
    expect(order!.reviewNote!.match(/Amount mismatch/g)).toHaveLength(1);
    expect(order!.reviewNote).toMatch(/₹1\.00 paid/);
  });

  it("the note sits next to the other notes instead of replacing them", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId, order } = await unsettledOrder(p, 1);
    await Order.updateOne({ _id: order._id }, { reviewNote: "Earlier note." });
    expect((await send(razorpayOrderId, 5)).status).toBe(200);
    const saved = await Order.findById(order._id).lean();
    expect(saved!.reviewNote).toMatch(/^Earlier note\. Amount mismatch/);
  });

  it("a webhook without an amount (the browser path never has one) is not flagged", async () => {
    const p = await product({ stockQuantity: 3 });
    const { razorpayOrderId } = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect((await send(razorpayOrderId)).status).toBe(200);
    expect((await Order.findOne({ razorpayOrderId }).lean())!.reviewNote).toBeUndefined();
  });
});

// ─── 5. checkout start limit ────────────────────────────────────────────────────
describe("checkout start limit", () => {
  it("one account may start 10 checkouts an hour; the 11th gets a friendly 429 and holds nothing", async () => {
    const p = await product({ stockQuantity: 50 });
    for (let i = 0; i < CHECKOUT_STARTS_PER_ACCOUNT; i++) {
      expect((await startCheckout(U1, [{ productId: String(p._id) }])).res.status).toBe(200);
    }
    const res = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect(res.res.status).toBe(429);
    expect(res.body.message).toMatch(/started checkout several times/);
    expect((await stockOf(p)).stockQuantity).toBe(49); // each start releases the previous hold: 1 held, the refused one took none
    // other accounts are not affected
    expect((await startCheckout(U2, [{ productId: String(p._id) }])).res.status).toBe(200);
  });

  it("the window ends after an hour", async () => {
    const p = await product({ stockQuantity: 50 });
    for (let i = 0; i < CHECKOUT_STARTS_PER_ACCOUNT; i++) await startCheckout(U1, [{ productId: String(p._id) }]);
    expect((await startCheckout(U1, [{ productId: String(p._id) }])).res.status).toBe(429);
    fakeRedis.advance(61 * 60 * 1000);
    expect((await startCheckout(U1, [{ productId: String(p._id) }])).res.status).toBe(200);
  });

  it("one address is limited across accounts", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < CHECKOUT_STARTS_PER_IP + 1; i++) results.push(await allowCheckoutStart(String(oid()), "203.0.113.9"));
    expect(results.slice(0, CHECKOUT_STARTS_PER_IP).every(Boolean)).toBe(true);
    expect(results[CHECKOUT_STARTS_PER_IP]).toBe(false);
    expect(await allowCheckoutStart(String(oid()), "203.0.113.10")).toBe(true);
  });

  it("counters always get an expiry (never a permanent block)", async () => {
    await allowCheckoutStart(U1, "203.0.113.9");
    expect(await fakeRedis.ttl(`checkout_start:user:${U1}`)).toBeGreaterThan(0);
    expect(await fakeRedis.ttl("checkout_start:ip:203.0.113.9")).toBeGreaterThan(0);
  });

  it("fails closed: when Redis cannot answer, the checkout is refused and no stock is held", async () => {
    const p = await product({ stockQuantity: 5 });
    vi.spyOn(fakeRedis, "multi").mockImplementation((() => { throw new Error("upstash unreachable"); }) as never);
    const res = await startCheckout(U1, [{ productId: String(p._id) }]);
    expect(res.res.status).toBe(500);
    expect((await stockOf(p)).stockQuantity).toBe(5);
    expect(await StockReservation.countDocuments()).toBe(0);
  });
});

// ─── 6. indexes ─────────────────────────────────────────────────────────────────
describe("indexes", () => {
  const plan = async (cursor: { explain: (v: string) => Promise<unknown> }) => JSON.stringify(await cursor.explain("queryPlanner"));

  it("orders.razorpayOrderId is unique: the database itself refuses a second order for a payment", async () => {
    const idx = (await Order.collection.indexes()).find((i) => i.key.razorpayOrderId === 1);
    expect(idx).toMatchObject({ unique: true, sparse: true });
    const { p, razorpayOrderId } = await paidOrder(5, 1);
    expect(p).toBeTruthy();
    const pending = { userId: oid(), items: [], totalAmount: 1, customerName: "a", email: "a@a.a", phone: "1", shippingAddress: { street: "a", city: "a", state: "a", zipCode: "1", country: "a" } };
    await expect(Order.create({ ...pending, razorpayOrderId })).rejects.toMatchObject({ code: 11000 });
    // orders without a payment id (none exist today) may coexist because the index is sparse
    await Order.create(pending);
    await Order.create(pending);
  });

  it("looking an order up by razorpayOrderId uses that index", async () => {
    const text = await plan(Order.find({ razorpayOrderId: "order_x" }) as never);
    expect(text).toContain("IXSCAN");
    expect(text).toContain("razorpayOrderId_1");
    expect(text).not.toContain("COLLSCAN");
  });

  it("the repair query uses the partial stockSettled index", async () => {
    const q = Order.find({ stockSettled: false, createdAt: { $lt: new Date() } });
    const text = await plan(q as never);
    expect(text).toContain("IXSCAN");
    expect(text).toContain("stockSettled_1_createdAt_1");
    // and the partial index holds only unsettled orders, so it stays tiny
    const idx = (await Order.collection.indexes()).find((i) => i.name === "stockSettled_1_createdAt_1");
    expect(idx!.partialFilterExpression).toEqual({ stockSettled: false });
  });

  it("unmatched payments: one row per Razorpay order, and the dashboard query uses its index", async () => {
    const idx = (await UnmatchedPayment.collection.indexes()).find((i) => i.key.razorpayOrderId === 1);
    expect(idx).toMatchObject({ unique: true });
    await UnmatchedPayment.create({ razorpayOrderId: "order_u", razorpayPaymentId: "pay_1", source: "webhook" });
    await expect(UnmatchedPayment.create({ razorpayOrderId: "order_u", razorpayPaymentId: "pay_2", source: "webhook" })).rejects.toMatchObject({ code: 11000 });
    const text = await plan(UnmatchedPayment.find({ resolvedAt: { $exists: false } }).sort({ createdAt: -1 }) as never);
    expect(text).toContain("IXSCAN");
  });
});

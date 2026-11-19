import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import fs from "node:fs";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState } from "./helpers/razorpay";
import { adminCall } from "./helpers/admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());

import { Product } from "@/models/product.model";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import { finalizeOrder } from "@/lib/finalize-order";
import { HOLD_MINUTES } from "@/lib/stock-reservation";
import { CHECKOUT_WINDOW_SECONDS, HOLD_MINUTES as SHARED_HOLD_MINUTES } from "@/lib/checkout-timing";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as ordersList from "@/app/api/admin/orders/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import * as orderRefund from "@/app/api/admin/orders/[id]/refund/route";
import * as profile from "@/app/api/profile/route";

setupTestDb();

const oid = () => new mongoose.Types.ObjectId();
const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
let n = 0;
const product = (over: Record<string, unknown> = {}) => {
  n++;
  return Product.create({
    name: `P${n}`, slug: `rd-${n}`, description: "d", category: "tees", price: 500,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: 50, ...over,
  });
};
const userCall = (h: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>, userId: string, json?: unknown) => {
  const headers = new Headers({ "x-user-id": userId });
  if (json !== undefined) headers.set("content-type", "application/json");
  return h(new NextRequest("http://localhost/api/test", { method: json !== undefined ? "POST" : "GET", headers, body: json !== undefined ? JSON.stringify(json) : undefined }), { params: Promise.resolve({}) });
};

/** A real paid order through create-order + finalizeOrder */
async function paidOrder(userId: string, items: { productId: string; quantity?: number; size?: string }[]) {
  const res = await userCall(createOrder.POST, userId, {
    items: items.map((i) => ({ quantity: 1, ...i })),
    customerName: "Test Buyer", email: "buyer@example.test", phone: "9999999999", shippingAddress: ADDRESS,
  });
  expect(res.status).toBe(200);
  const { razorpayOrderId } = await res.json();
  const done = await finalizeOrder({ razorpayOrderId, razorpayPaymentId: `pay_${razorpayOrderId}`, userId });
  if (!done.ok) throw new Error(done.message);
  return (await Order.findById(done.order._id))!;
}

const patch = (handler: typeof orderStatus.PATCH, id: string, json: unknown, role = "admin") =>
  adminCall(handler, { method: "PATCH", json, role }, { id });

let user: string;
beforeEach(async () => {
  fakeRedis.reset();
  razorpayState.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  user = String((await User.create({ name: "A", email: `a${Date.now()}${Math.random()}@x.test`, password: "x", isVerified: true }))._id);
});
afterEach(() => vi.restoreAllMocks());

describe("Razorpay Checkout window length", () => {
  it("is shorter than the stock hold and derived from the same number", () => {
    expect(SHARED_HOLD_MINUTES).toBe(HOLD_MINUTES);
    expect(HOLD_MINUTES).toBe(15);
    expect(CHECKOUT_WINDOW_SECONDS).toBe(15 * 60 - 60);
    expect(CHECKOUT_WINDOW_SECONDS).toBeLessThan(HOLD_MINUTES * 60);
    expect(Number.isInteger(CHECKOUT_WINDOW_SECONDS)).toBe(true);
  });

  it("the checkout page passes it to Razorpay as `timeout`", () => {
    const source = fs.readFileSync("src/components/checkout/CheckoutPageClient.tsx", "utf8");
    expect(source).toMatch(/timeout:\s*CHECKOUT_WINDOW_SECONDS/);
  });
});

describe("cancelling a paid order lists it as refund pending", () => {
  it("sets PENDING in the same step, asks the page to remind the admin, and a second cancel changes nothing", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    expect(order.refundStatus).toBeUndefined();

    const res = await patch(orderStatus.PATCH, String(order._id), { status: "CANCELLED" });
    expect(res.status).toBe(200);
    expect((await res.json()).refundReminder).toBe(true);
    expect((await Order.findById(order._id))!).toMatchObject({ status: "CANCELLED", refundStatus: "PENDING" });

    expect((await patch(orderStatus.PATCH, String(order._id), { status: "CANCELLED" })).status).toBe(409);
  });

  it("keeps a refund status the admin already recorded", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    await patch(orderRefund.PATCH, String(order._id), { refundStatus: "NOT_NEEDED" });
    await patch(orderStatus.PATCH, String(order._id), { status: "CANCELLED" });
    expect((await Order.findById(order._id))!.refundStatus).toBe("NOT_NEEDED");
  });

  it("other status changes do not touch the refund status", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    const res = await patch(orderStatus.PATCH, String(order._id), { status: "SHIPPED" });
    expect((await res.json()).refundReminder).toBe(false);
    expect((await Order.findById(order._id))!.refundStatus).toBeUndefined();
  });
});

describe("recording a refund by hand", () => {
  it("saves status, note and Razorpay refund id; an empty note or id clears it; nothing else changes", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    const id = String(order._id);
    const before = order.toObject();

    const ok = await patch(orderRefund.PATCH, id, { refundStatus: "REFUNDED", refundNote: "  Refunded via UPI  ", razorpayRefundId: "rfnd_ABC123xyz" });
    expect(ok.status).toBe(200);
    const saved = (await Order.findById(id))!;
    expect(saved).toMatchObject({ refundStatus: "REFUNDED", refundNote: "Refunded via UPI", razorpayRefundId: "rfnd_ABC123xyz" });
    expect(saved).toMatchObject({ status: before.status, totalAmount: before.totalAmount, paymentStatus: "PAID" });

    await patch(orderRefund.PATCH, id, { refundStatus: "PENDING", refundNote: "", razorpayRefundId: "" });
    const cleared = (await Order.findById(id).lean())!;
    expect(cleared.refundStatus).toBe("PENDING");
    expect(cleared.refundNote).toBeUndefined();
    expect(cleared.razorpayRefundId).toBeUndefined();
  });

  it("rejects bad input and saves nothing; only admins; unknown and invalid ids", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    const id = String(order._id);
    for (const bad of [
      { refundStatus: "DONE" },
      { refundStatus: "REFUNDED", razorpayRefundId: "rfnd 123; DROP" },
      { refundStatus: "REFUNDED", razorpayRefundId: "r".repeat(65) },
      { refundStatus: "REFUNDED", refundNote: "x".repeat(501) },
      {},
    ]) {
      expect((await patch(orderRefund.PATCH, id, bad)).status, JSON.stringify(bad).slice(0, 40)).toBe(400);
    }
    expect((await Order.findById(id))!.refundStatus).toBeUndefined();
    expect((await patch(orderRefund.PATCH, id, { refundStatus: "PENDING" }, "user")).status).toBe(403);
    expect((await patch(orderRefund.PATCH, String(oid()), { refundStatus: "PENDING" })).status).toBe(404);
    expect((await patch(orderRefund.PATCH, "not-an-id", { refundStatus: "PENDING" })).status).toBe(400);
  });

  it("the admin list has a Refund pending filter and count", async () => {
    const p = await product();
    const a = await paidOrder(user, [{ productId: String(p._id) }]);
    const b = await paidOrder(String(oid()), [{ productId: String(p._id) }]);
    await patch(orderStatus.PATCH, String(a._id), { status: "CANCELLED" });
    const call = (status: string) => ordersList.GET(
      new NextRequest(`http://localhost/api/admin/orders?status=${status}`, { headers: { "x-user-role": "admin", "x-user-id": "u1", "x-user-email": "a@b.c" } }),
      { params: Promise.resolve({}) },
    );
    const pending = await (await call("REFUND_PENDING")).json();
    expect(pending.orders.map((o: { _id: string }) => String(o._id))).toEqual([String(a._id)]);
    expect(pending.statusCounts.REFUND_PENDING).toBe(1);
    const all = await (await call("ALL")).json();
    expect(all.orders).toHaveLength(2);
    expect(all.statusCounts.REFUND_PENDING).toBe(1);
    void b;
  });

  it("the customer sees only the neutral refund state, never notes, ids or review notes", async () => {
    const p = await product();
    const order = await paidOrder(user, [{ productId: String(p._id) }]);
    await patch(orderStatus.PATCH, String(order._id), { status: "CANCELLED" });
    await patch(orderRefund.PATCH, String(order._id), { refundStatus: "PENDING", refundNote: "INTERNAL-NOTE", razorpayRefundId: "rfnd_SECRET1" });
    await Order.updateOne({ _id: order._id }, { reviewNote: "Possible duplicate payment: INTERNAL-REVIEW" });
    const body = await (await userCall(profile.GET, user)).json();
    const text = JSON.stringify(body);
    expect(body.orders[0]).toMatchObject({ status: "CANCELLED", refundStatus: "PENDING" });
    for (const secret of ["INTERNAL-NOTE", "rfnd_SECRET1", "INTERNAL-REVIEW", "razorpayRefundId"]) expect(text).not.toContain(secret);
  });
});

describe("possible duplicate payment", () => {
  const noteOf = async (o: { _id: unknown }) => (await Order.findById(o._id).lean())!.reviewNote ?? "";

  it("flags the second paid order for the same account and the same items within 30 minutes", async () => {
    const p = await product();
    const first = await paidOrder(user, [{ productId: String(p._id), quantity: 2, size: "M" }]);
    const second = await paidOrder(user, [{ productId: String(p._id), quantity: 2, size: "M" }]);
    expect(await noteOf(first)).toBe("");
    const note = await noteOf(second);
    expect(note).toContain("Possible duplicate payment");
    expect(note).toContain(`#${String(first._id).slice(-6).toUpperCase()}`);
  });

  it("the order of the lines does not matter", async () => {
    const [p, q] = [await product(), await product()];
    await paidOrder(user, [{ productId: String(p._id) }, { productId: String(q._id) }]);
    const second = await paidOrder(user, [{ productId: String(q._id) }, { productId: String(p._id) }]);
    expect(await noteOf(second)).toContain("Possible duplicate payment");
  });

  it("does not flag different items, a different quantity or size, or another account", async () => {
    const [p, q] = [await product(), await product()];
    await paidOrder(user, [{ productId: String(p._id), quantity: 1, size: "M" }]);
    expect(await noteOf(await paidOrder(user, [{ productId: String(q._id), quantity: 1, size: "M" }]))).toBe("");
    expect(await noteOf(await paidOrder(user, [{ productId: String(p._id), quantity: 2, size: "M" }]))).toBe("");
    expect(await noteOf(await paidOrder(user, [{ productId: String(p._id), quantity: 1, size: "L" }]))).toBe("");
    expect(await noteOf(await paidOrder(String(oid()), [{ productId: String(p._id), quantity: 1, size: "M" }]))).toBe("");
  });

  it("does not flag after 30 minutes, or when the earlier order was cancelled", async () => {
    const p = await product();
    const old = await paidOrder(user, [{ productId: String(p._id) }]);
    await Order.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await noteOf(await paidOrder(user, [{ productId: String(p._id) }]))).toBe("");

    const q = await product();
    const cancelled = await paidOrder(user, [{ productId: String(q._id) }]);
    await patch(orderStatus.PATCH, String(cancelled._id), { status: "CANCELLED" });
    expect(await noteOf(await paidOrder(user, [{ productId: String(q._id) }]))).toBe("");
  });

  it("a repeated finalize (webhook retry) neither duplicates the note nor flags the order against itself", async () => {
    const p = await product();
    const first = await paidOrder(user, [{ productId: String(p._id) }]);
    expect(await noteOf(first)).toBe("");
    const again = await finalizeOrder({ razorpayOrderId: String(first.razorpayOrderId), razorpayPaymentId: `pay_${first.razorpayOrderId}`, userId: user });
    expect(again.ok).toBe(true);
    expect(await noteOf(first)).toBe("");
  });
});

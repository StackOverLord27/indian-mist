import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";
import { Order } from "@/models/order.model";
import { checkOrdersIndexNow, evaluateOrdersIndexes, getOrdersIndexHealth, resetDbHealthForTests } from "@/lib/db-health";
import * as health from "@/app/api/admin/health/route";
import * as ordersList from "@/app/api/admin/orders/route";

setupTestDb();

let errors: string[];
beforeEach(() => {
  resetDbHealthForTests();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
});
afterEach(() => vi.restoreAllMocks());

const setIndex = async (state: "plain" | "unique" | "unique-not-sparse" | "none") => {
  await Order.collection.dropIndex("razorpayOrderId_1").catch(() => {});
  if (state === "plain") await Order.collection.createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1" });
  if (state === "unique") await Order.collection.createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1", unique: true, sparse: true });
  if (state === "unique-not-sparse") await Order.collection.createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1", unique: true });
};

describe("evaluateOrdersIndexes (pure)", () => {
  it("only a unique AND sparse single-field index on razorpayOrderId is fine", () => {
    expect(evaluateOrdersIndexes([{ name: "x_1", key: { razorpayOrderId: 1 }, unique: true, sparse: true }])).toEqual({ ok: true });
    expect(evaluateOrdersIndexes([{ name: "razorpayOrderId_1", key: { razorpayOrderId: 1 } }]).problem).toMatch(/not unique and sparse/);
    expect(evaluateOrdersIndexes([{ name: "razorpayOrderId_1", key: { razorpayOrderId: 1 }, unique: true }]).problem).toMatch(/not sparse/);
    expect(evaluateOrdersIndexes([{ name: "a", key: { razorpayOrderId: 1, userId: 1 }, unique: true, sparse: true }]).problem).toMatch(/no index on orders.razorpayOrderId/);
    expect(evaluateOrdersIndexes([]).ok).toBe(false);
  });
});

describe("the check against the live collection", () => {
  it("a PLAIN index logs one clear [db] CRITICAL line, once per server instance", async () => {
    await setIndex("plain");
    const first = await checkOrdersIndexNow();
    const second = await checkOrdersIndexNow();
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    const critical = errors.filter((l) => l.startsWith("[db] CRITICAL"));
    expect(critical).toHaveLength(1);
    expect(critical[0]).toMatch(/not unique and sparse/);
    expect(critical[0]).toMatch(/npm run ensure:indexes/);
  });

  it("no index at all, or unique without sparse, are reported too", async () => {
    await setIndex("none");
    expect((await checkOrdersIndexNow()).problem).toMatch(/no index/);
    resetDbHealthForTests();
    await setIndex("unique-not-sparse");
    expect((await checkOrdersIndexNow()).problem).toMatch(/not sparse/);
  });

  it("the declared unique sparse index is fine and logs nothing", async () => {
    await setIndex("unique");
    expect((await checkOrdersIndexNow()).ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it("the answer is cached: no query per call, and it re-checks after 10 minutes", async () => {
    await setIndex("plain");
    const spy = vi.spyOn(Order.collection.conn.db!.collection("orders").constructor.prototype, "indexes");
    await getOrdersIndexHealth();
    await getOrdersIndexHealth();
    await getOrdersIndexHealth();
    expect(spy).toHaveBeenCalledTimes(1);
    // the owner repairs the index; within 10 minutes the old answer stands, after that it clears by itself
    await setIndex("unique");
    expect((await getOrdersIndexHealth()).ok).toBe(false);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 11 * 60_000 });
    expect((await getOrdersIndexHealth()).ok).toBe(true);
    vi.useRealTimers();
  });

  it("a failing check never throws and is not reported as a broken index", async () => {
    vi.spyOn(Order, "init").mockRejectedValue(new Error("boom"));
    vi.spyOn(Order.collection.conn.db!.collection("orders").constructor.prototype, "indexes").mockRejectedValue(new Error("db down"));
    const r = await checkOrdersIndexNow();
    expect(r.ok).toBe(true);
    expect(errors.join("\n")).toMatch(/could not check the orders indexes: db down/);
  });
});

describe("where an index build failure surfaces", () => {
  it("Mongoose's own 'index' event for the orders model is now logged as CRITICAL (it used to be silent)", async () => {
    await setIndex("plain");
    await Order.ensureIndexes().catch(() => {});
    expect(errors.some((l) => l.startsWith("[db] CRITICAL: building the orders indexes failed") && l.includes("IndexKeySpecsConflict") || l.includes("same name"))).toBe(true);
  });
});

describe("the admin endpoint behind the dashboard warning", () => {
  it("is admin only and reports the problem text", async () => {
    await setIndex("plain");
    expect((await adminCall(health.GET, { role: "user" })).status).toBe(403);
    const res = await adminCall(health.GET, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ordersIndex.ok).toBe(false);
    expect(body.ordersIndex.problem).toMatch(/not unique and sparse/);
  });
  it("says ok when the index is right", async () => {
    await setIndex("unique");
    expect((await (await adminCall(health.GET, {})).json()).ordersIndex).toEqual({ ok: true, problem: null });
  });
});

describe("the admin orders list marks orders that share a payment id", () => {
  const order = (over: Record<string, unknown>) => ({
    userId: "507f1f77bcf86cd799439011", status: "PROCESSING", paymentStatus: "PAID", totalAmount: 10, customerName: "A", email: "a@x.test", phone: "1",
    shippingAddress: { street: "s", city: "c", state: "s", zipCode: "1", country: "India" }, items: [], ...over,
  });
  it("lists the OTHER order ids on each of the pair, and nothing on single orders", async () => {
    await setIndex("plain");
    const [a, b, c] = (await Order.create([
      order({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_dup" }),
      order({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_dup" }),
      order({ razorpayOrderId: "order_2", razorpayPaymentId: "pay_single" }),
    ] as never[])) as unknown as { _id: { toString(): string } }[];
    const res = await adminCall(ordersList.GET, {});
    const body = await res.json();
    const { orders } = body;
    const by = (id: { toString(): string }) => orders.find((o: { _id: string }) => o._id === String(id));
    expect(by(a._id).samePaymentAs).toEqual([String(b._id)]);
    expect(by(b._id).samePaymentAs).toEqual([String(a._id)]);
    expect(by(c._id).samePaymentAs).toBeUndefined();
  });
});
void NextRequest;

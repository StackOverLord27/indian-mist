import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState } from "./helpers/razorpay";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());

import { Product } from "@/models/product.model";
import Settings from "@/models/settings.model";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as settingsApi from "@/app/api/settings/route";
import { computeOrderTotals, freeShippingProgress, type ShippingRules } from "@/lib/order-totals";
import { resolveShippingRules } from "@/lib/shipping-rules";
import { SHIPPING_COST, SHIPPING_THRESHOLD } from "@/lib/constants";
import { promoDiscount } from "@/lib/promo";

setupTestDb();

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const call = (h: Handler, o: { method?: string; json?: unknown; userId?: string } = {}) => {
  const headers = new Headers();
  if (o.userId) headers.set("x-user-id", o.userId);
  let body: string | undefined;
  if (o.json !== undefined) { body = JSON.stringify(o.json); headers.set("content-type", "application/json"); }
  return h(new NextRequest("http://localhost/api/test", { method: o.method ?? "POST", headers, body }), { params: Promise.resolve({}) });
};

let n = 0;
const product = (price: number) => {
  n++;
  return Product.create({
    name: `P${n}`, slug: `sp-${n}`, description: "d", category: "tees", price,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: 50,
  });
};
const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };

beforeEach(() => {
  fakeRedis.reset();
  razorpayState.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("computeOrderTotals (the one shared calculation)", () => {
  const rules: ShippingRules = { shippingCost: 70, freeShippingThreshold: 500 };

  it("charges shipping below the threshold and not at or above it", () => {
    expect(computeOrderTotals({ subtotal: 499.99, rules })).toMatchObject({ shippingFree: false, shippingCost: 70, total: 569.99, totalPaise: 56999 });
    expect(computeOrderTotals({ subtotal: 500, rules })).toMatchObject({ shippingFree: true, shippingCost: 0, total: 500, totalPaise: 50000 });
    expect(computeOrderTotals({ subtotal: 500.01, rules })).toMatchObject({ shippingFree: true, total: 500.01 });
  });

  it("compares the threshold with the subtotal BEFORE the discount, and never goes below zero", () => {
    expect(computeOrderTotals({ subtotal: 520, discount: 100, rules })).toMatchObject({ shippingFree: true, total: 420 });
    expect(computeOrderTotals({ subtotal: 100, discount: 500, rules })).toMatchObject({ discountedSubtotal: 0, total: 70 });
  });

  it("rounds to whole paise like the server charges", () => {
    const t = computeOrderTotals({ subtotal: 100.005, discount: 0.001, rules });
    expect(Number.isInteger(t.totalPaise)).toBe(true);
    expect(t.total).toBe(t.totalPaise / 100);
  });

  it("free-shipping message: remaining and bar come from the given threshold", () => {
    expect(freeShippingProgress(250, { shippingCost: 70, freeShippingThreshold: 500 })).toEqual({ remaining: 250, percent: 50 });
    expect(freeShippingProgress(250, { shippingCost: 70, freeShippingThreshold: 999 }).remaining).toBe(749); // the old wrong message
    expect(freeShippingProgress(600, rules)).toEqual({ remaining: 0, percent: 100 });
  });
});

describe("the server's last-resort values", () => {
  it("are used only when nothing is saved, field by field", () => {
    expect(resolveShippingRules(null)).toEqual({ shippingCost: SHIPPING_COST, freeShippingThreshold: SHIPPING_THRESHOLD });
    expect(resolveShippingRules({ freeShippingThreshold: 300 })).toEqual({ shippingCost: SHIPPING_COST, freeShippingThreshold: 300 });
    expect(resolveShippingRules({ shippingCost: 0, freeShippingThreshold: 0 })).toEqual({ shippingCost: 0, freeShippingThreshold: 0 }); // 0 is a real choice
  });

  it("no browser code imports the constants or the server's rule file", () => {
    const roots = ["src/components", "src/hooks", "src/lib/cart-store.ts"];
    const files: string[] = [];
    const walk = (p: string) => {
      if (fs.statSync(p).isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
      else if (/\.tsx?$/.test(p)) files.push(p);
    };
    roots.forEach((r) => walk(path.resolve(r)));
    // client pages in src/app too
    const walkApp = (p: string) => {
      if (fs.statSync(p).isDirectory()) { if (!p.endsWith(`${path.sep}api`)) fs.readdirSync(p).forEach((f) => walkApp(path.join(p, f))); }
      else if (/\.tsx?$/.test(p) && fs.readFileSync(p, "utf8").trimStart().startsWith('"use client"')) files.push(p);
    };
    walkApp(path.resolve("src/app"));
    const offenders = files.filter((f) => /@\/lib\/constants|@\/lib\/shipping-rules/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("cart total = checkout total = what create-order charges", () => {
  // What the browser does: read the rules from GET /api/settings, then run the shared calculation.
  async function browserRules(): Promise<ShippingRules> {
    const body = await (await call(settingsApi.GET, { method: "GET" })).json();
    return body.shippingRules;
  }
  async function serverCharge(subtotal: number, extra: Record<string, unknown> = {}) {
    const p = await product(subtotal);
    const userId = String(new mongoose.Types.ObjectId()); // a fresh account each time (checkout starts are limited per account)
    const res = await call(createOrder.POST, { userId, json: { items: [{ productId: String(p._id), quantity: 1 }], customerName: "Test Buyer", email: "buyer@example.test", phone: "9999999999", shippingAddress: ADDRESS, ...extra } });
    expect(res.status).toBe(200);
    const body = await res.json();
    return { totalAmount: body.totalAmount as number, paise: razorpayState.orders.at(-1)!.amount as number };
  }
  const around = (t: number) => [t - 250, t - 1, t - 0.01, t, t + 0.01, t + 1, t + 250].filter((s) => s >= 1);

  it("saved settings (threshold 400, fee 60): the browser's rules are the saved ones, and every total agrees", async () => {
    await Settings.create({ pricingSettings: { shippingCost: 60, freeShippingThreshold: 400 } });
    const rules = await browserRules();
    expect(rules).toEqual({ shippingCost: 60, freeShippingThreshold: 400 });
    for (const subtotal of around(400)) {
      const cartAndCheckout = computeOrderTotals({ subtotal, rules });
      const charged = await serverCharge(subtotal);
      expect(charged.paise, `subtotal ${subtotal}`).toBe(cartAndCheckout.totalPaise);
      expect(charged.totalAmount, `subtotal ${subtotal}`).toBe(cartAndCheckout.total);
    }
  });

  it("with a promo code the discount path agrees too", async () => {
    const promo = { code: "TEN", discountType: "PERCENTAGE", discountValue: 10, isActive: true, minOrderValue: 0, maxUses: 0, maxUsesPerUser: 0 };
    await Settings.create({ pricingSettings: { shippingCost: 60, freeShippingThreshold: 400, promoCodes: [promo] } });
    const rules = await browserRules();
    for (const subtotal of around(400)) {
      const discount = promoDiscount(promo as never, subtotal);
      const shown = computeOrderTotals({ subtotal, discount, rules });
      const charged = await serverCharge(subtotal, { promoCode: "TEN" });
      expect(charged.paise, `subtotal ${subtotal}`).toBe(shown.totalPaise);
    }
  });

  it("nothing saved: the browser is told the server's last-resort values (it holds no numbers of its own) and they match the charge", async () => {
    const rules = await browserRules();
    expect(rules).toEqual({ shippingCost: SHIPPING_COST, freeShippingThreshold: SHIPPING_THRESHOLD });
    for (const subtotal of around(SHIPPING_THRESHOLD)) {
      const charged = await serverCharge(subtotal);
      expect(charged.paise, `subtotal ${subtotal}`).toBe(computeOrderTotals({ subtotal, rules }).totalPaise);
    }
  });

  it("GET /api/settings never lists promo codes, and still returns the rules", async () => {
    await Settings.create({ pricingSettings: { shippingCost: 60, freeShippingThreshold: 400, promoCodes: [{ code: "SECRET", discountType: "FIXED", discountValue: 5 }] } });
    const body = await (await call(settingsApi.GET, { method: "GET" })).json();
    expect(JSON.stringify(body)).not.toContain("SECRET");
    expect(body.shippingRules).toEqual({ shippingCost: 60, freeShippingThreshold: 400 });
  });
});

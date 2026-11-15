import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState } from "./helpers/razorpay";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());

import { revalidatePath } from "next/cache";
import { Product } from "@/models/product.model";
import { StockReservation } from "@/models/stock-reservation.model";
import { User } from "@/models/user.model";
import { reserveStock, resetSweepThrottleForTests } from "@/lib/stock-reservation";
import { CATALOG_REVALIDATE_MIN_GAP_MS, resetCatalogThrottleForTests, revalidateCatalogThrottled } from "@/lib/revalidate-storefront";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as release from "@/app/api/checkout/release/route";
import * as cart from "@/app/api/products/cart/route";

setupTestDb();

const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
const refreshed = () => vi.mocked(revalidatePath).mock.calls.length;
const productPages = () => vi.mocked(revalidatePath).mock.calls.filter((c) => c[0] === "/products/[slug]").length;
let n = 0;
let user: string;

const newProduct = (stock = 20) => {
  n++;
  return Product.create({ name: `P${n}`, slug: `sr-${n}`, description: "d", category: "tees", price: 500, images: [{ url: "https://x/a.jpg", publicId: "x", alt: "", isPrimary: true }], trackInventory: true, stockQuantity: stock });
};
const call = (h: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>, json: unknown, userId = user) =>
  h(new NextRequest("http://localhost/api/test", { method: "POST", headers: { "x-user-id": userId, "content-type": "application/json" }, body: JSON.stringify(json) }), { params: Promise.resolve({}) });
const startCheckout = (productId: string, quantity = 1, userId = user) => call(createOrder.POST, {
  items: [{ productId, quantity }], customerName: "Test Buyer", email: "buyer@example.test", phone: "9999999999", shippingAddress: ADDRESS,
}, userId);

beforeEach(async () => {
  fakeRedis.reset();
  razorpayState.reset();
  vi.mocked(revalidatePath).mockClear();
  resetCatalogThrottleForTests();
  resetSweepThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  user = String((await User.create({ name: "A", email: `a${Math.random()}@x.test`, password: "x", isVerified: true }))._id);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("the throttle", () => {
  it("runs at most once per gap per instance, then again after the gap", () => {
    expect(revalidateCatalogThrottled(1_000_000)).toBe(true);
    const callsAfterFirst = refreshed();
    expect(callsAfterFirst).toBeGreaterThan(0);
    for (let t = 1; t < CATALOG_REVALIDATE_MIN_GAP_MS; t += 500) expect(revalidateCatalogThrottled(1_000_000 + t)).toBe(false);
    expect(refreshed()).toBe(callsAfterFirst);
    expect(revalidateCatalogThrottled(1_000_000 + CATALOG_REVALIDATE_MIN_GAP_MS)).toBe(true);
    expect(refreshed()).toBe(callsAfterFirst * 2);
  });
});

describe("product pages are refreshed when stock moves", () => {
  it("starting a checkout takes stock: pages refreshed", async () => {
    const p = await newProduct();
    const res = await startCheckout(String(p._id));
    expect(res.status).toBe(200);
    expect(productPages()).toBe(1);
  });

  it("closing the payment window releases the hold: pages refreshed (and the stock is back)", async () => {
    const p = await newProduct(3);
    const { razorpayOrderId } = await (await startCheckout(String(p._id), 3)).json();
    expect((await Product.findById(p._id))!.stockQuantity).toBe(0);
    resetCatalogThrottleForTests();
    vi.mocked(revalidatePath).mockClear();
    const res = await call(release.POST, { razorpayOrderId });
    expect((await res.json()).released).toBe(true);
    expect(productPages()).toBe(1);
    expect((await Product.findById(p._id))!.stockQuantity).toBe(3);
  });

  it("a release that changed nothing (already released) does not refresh anything", async () => {
    const p = await newProduct();
    const { razorpayOrderId } = await (await startCheckout(String(p._id))).json();
    await call(release.POST, { razorpayOrderId });
    resetCatalogThrottleForTests();
    vi.mocked(revalidatePath).mockClear();
    expect((await (await call(release.POST, { razorpayOrderId })).json()).released).toBe(false);
    expect(refreshed()).toBe(0);
  });

  it("an expired hold swept by the cart check returns the stock and refreshes the pages", async () => {
    const p = await newProduct(5);
    const hold = await reserveStock(user, [{ productId: String(p._id), quantity: 2 }]);
    await StockReservation.updateOne({ _id: (hold as { reservationId: string }).reservationId }, { expiresAt: new Date(Date.now() - 1000) });
    resetSweepThrottleForTests();
    const res = await call(cart.POST, { items: [{ productId: String(p._id) }] });
    expect(res.status).toBe(200);
    expect((await Product.findById(p._id))!.stockQuantity).toBe(5);
    expect(productPages()).toBe(1);
  });

  it("a cart check with nothing to release refreshes nothing", async () => {
    const p = await newProduct();
    await call(cart.POST, { items: [{ productId: String(p._id) }] });
    expect(refreshed()).toBe(0);
  });

  it("many checkouts in a burst cause ONE refresh, not one each (no storm)", async () => {
    const p = await newProduct(100);
    for (let i = 0; i < 8; i++) {
      fakeRedis.reset(); // the per-address checkout limits are not what is tested
      const shopper = String((await User.create({ name: "S", email: `s${i}${Math.random()}@x.test`, password: "x", isVerified: true }))._id);
      expect((await startCheckout(String(p._id), 1, shopper)).status).toBe(200);
    }
    expect(productPages()).toBe(1);
  });
});

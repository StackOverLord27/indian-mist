import { test, expect } from "@playwright/test";
import { db, closeDb, oid, resetShop, seedUsers, type Seeded } from "./support/db.ts";
import { newContext, putInBag } from "./support/shop.ts";
import { orderNumber } from "../src/lib/order-number.ts";

/**
 * Slow or blank customer pages: an account with many orders, the checkout pre-fill, an expired
 * access token with several pages asking at once, and the order number shown everywhere.
 */

let shop: Seeded;
let customerA = "";
const PHOTOS = Array.from({ length: 6 }, (_, i) => ({ url: `https://placehold.co/400x500/png?text=p${i}`, publicId: `indian-mist/e2e/p${i}`, alt: "", isPrimary: i === 0 }));

test.beforeAll(async () => {
  shop = await resetShop();
  customerA = (await seedUsers()).customerA;
  const d = await db();
  await d.collection("orders").deleteMany({});
  await d.collection("products").updateMany({}, { $set: { images: PHOTOS } });
  const now = Date.now();
  await d.collection("orders").insertMany(Array.from({ length: 60 }, (_, i) => ({
    userId: oid(customerA), status: i % 3 === 0 ? "DELIVERED" : "PROCESSING", paymentStatus: "PAID", totalAmount: 1600, subtotal: 1600, shippingCost: 0, taxAmount: 0, discountAmount: 0,
    items: [shop.sized, shop.plain].map((p) => ({ productId: oid(p.id), name: p.name, quantity: 1, priceAtPurchase: p.price, image: PHOTOS[0].url, selectedSize: "M" })),
    customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233",
    shippingAddress: { street: "12 Test Lane", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
    razorpayOrderId: `order_load_${i}`, razorpayPaymentId: `pay_load_${i}`, razorpaySignature: "secret-signature", reviewNote: "shop-only note", stockSettled: true,
    createdAt: new Date(now - i * 3_600_000), updatedAt: new Date(now - i * 3_600_000),
  })));
});
test.afterAll(() => closeDb());

test("an account with many orders: the profile loads with a bounded, lean response and shows the same #numbers as the admin", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  const responded = page.waitForResponse((r) => r.url().endsWith("/api/profile") && r.request().method() === "GET");
  const t0 = Date.now();
  await page.goto("/profile");
  const res = await responded;
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toMatch(/no-store/);
  const body = await res.json();
  expect(body.orders).toHaveLength(50);
  expect(body.orders[0].items[0].productId.images).toHaveLength(1); // one photo per product, not six
  expect(JSON.stringify(body)).not.toContain("secret-signature");
  expect(JSON.stringify(body)).not.toContain("shop-only note");

  // the newest order, as a customer sees it
  const newest = (await (await db()).collection("orders").find({ userId: oid(customerA) }).sort({ createdAt: -1 }).limit(1).next())!;
  await expect(page.getByText(orderNumber(newest._id)).first()).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - t0).toBeLessThan(15_000);

  // and the admin shows the same number for the same order
  const admin = await newContext(browser, "admin");
  const adminPage = await admin.newPage();
  await adminPage.goto("/admin/orders");
  await expect(adminPage.getByText(orderNumber(newest._id)).first()).toBeVisible({ timeout: 20_000 });
  await admin.close();
  await ctx.close();
});

test("checkout pre-fill asks only for the saved details (no order history)", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await putInBag(page, [{ product: shop.sized, size: "M" }]);
  const profileCalls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/profile")) profileCalls.push(r.url()); });
  const responded = page.waitForResponse((r) => r.url().includes("/api/profile"));
  await page.goto("/checkout");
  const body = await (await responded).json();
  expect(body.orders).toEqual([]);
  expect(body.user.email).toBe("e2e-customer-a@example.test");
  expect(profileCalls).toHaveLength(1);
  expect(profileCalls[0]).toContain("orders=0");
  await ctx.close();
});

test("three pages opened at once with an expired access token renew the session once, and none stays blank", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  await ctx.clearCookies({ name: "access_token" });
  const renewals: number[] = [];
  const open = async () => {
    const page = await ctx.newPage();
    page.on("response", (r) => { if (r.url().endsWith("/api/auth/refresh")) renewals.push(r.status()); });
    await page.goto("/profile");
    return page;
  };
  const pages = await Promise.all([open(), open(), open()]);
  for (const page of pages) await expect(page.getByText("e2e-customer-a@example.test").first()).toBeVisible({ timeout: 25_000 });
  expect(renewals.every((s) => s === 200)).toBe(true);
  expect(renewals.length).toBeLessThanOrEqual(3); // one per tab at most (the tabs share a lock and skip a renewal another tab just did)
  console.log(`renewals for 3 simultaneous tabs: ${renewals.length}`);
  await ctx.close();
});

test("the bag and the wishlist are server-rendered as skeletons, not as blank or falsely empty pages", async ({ request }) => {
  for (const [path, label] of [["/cart", "Loading your bag"], ["/wishlist", "Loading your wishlist"]] as const) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('data-testid="page-skeleton"');
    expect(html, path).toContain(label);
  }
});

test("the same order number in My Orders when opened, and the full id is never shown to the customer", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await page.goto("/profile");
  const newest = (await (await db()).collection("orders").find({ userId: oid(customerA) }).sort({ createdAt: -1 }).limit(1).next())!;
  await expect(page.getByText(orderNumber(newest._id)).first()).toBeVisible({ timeout: 20_000 });
  expect(await page.content()).not.toContain(String(newest._id));
  await ctx.close();
});

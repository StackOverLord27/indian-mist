import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { test, expect, type Page } from "@playwright/test";
import { db, closeDb, oid, resetShop, seedUsers, type Seeded } from "./support/db.ts";
import { newContext } from "./support/shop.ts";
import { BASE_URL } from "./support/env.ts";
import { sendSignedWebhook, webhookPayload } from "./support/razorpay.ts";

const require = createRequire(import.meta.url);

/**
 * One payment, one order. These tests do not call Razorpay (so they run with any keys): the
 * "pending order" is written to Redis the way create-order writes it, then the browser
 * confirmation (verify-payment, signed with the key secret) and the Razorpay webhook (signed with
 * the webhook secret) are fired at the real built app at the same moment, against a database whose
 * razorpayOrderId index is the PLAIN one the live database had.
 */

let shop: Seeded;
let customerA = "";
test.beforeAll(async () => { customerA = (await seedUsers()).customerA; });
test.afterAll(async () => {
  const d = await db();
  await d.collection("orders").deleteMany({}); // duplicates would stop the unique index from being built again
  await d.collection("orders").dropIndex("razorpayOrderId_1").catch(() => {});
  await d.collection("orders").createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1", unique: true, sparse: true }); // leave the declared index behind
  await closeDb();
});

const redis = () => {
  const { Redis } = require("@upstash/redis");
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
};
/** The live database's state: the same index name, but not unique (so duplicates can be stored) */
async function plainIndex() {
  const d = await db();
  await d.collection("orders").dropIndex("razorpayOrderId_1").catch(() => {});
  await d.collection("orders").createIndex({ razorpayOrderId: 1 }, { name: "razorpayOrderId_1" });
}
const sign = (orderId: string, paymentId: string) => createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest("hex");

async function seedPending(orderId: string, quantity: number) {
  await redis().set(`pending_order_${orderId}`, {
    userId: customerA,
    items: [{ productId: shop.plain.id, name: shop.plain.name, quantity, priceAtPurchase: shop.plain.price, image: "" }],
    totalAmount: shop.plain.price * quantity, subtotal: shop.plain.price * quantity, shippingCost: 0, taxAmount: 0, discountAmount: 0,
    customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233",
    shippingAddress: { street: "12 Test Lane", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
  }, { ex: 3600 });
}

test("confirmation and webhook arriving together (plain razorpayOrderId index): exactly one order and one stock deduction, every round", async ({ browser }) => {
  test.setTimeout(240_000);
  shop = await resetShop();
  const d = await db();
  await d.collection("products").updateOne({ _id: oid(shop.plain.id) }, { $set: { stockQuantity: 1000 } });
  await plainIndex();

  const ctx = await newContext(browser, "customer-a");
  const created: string[] = [];
  let stock = 1000;
  for (let round = 0; round < 12; round++) {
    const orderId = `order_dupe_${Date.now()}_${round}`;
    const paymentId = `pay_dupe_${Date.now()}_${round}`;
    created.push(orderId);
    await seedPending(orderId, 2);

    const verify = () => ctx.request.post(`${BASE_URL}/api/checkout/verify-payment`, {
      data: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sign(orderId, paymentId) },
    });
    const hook = (event: "payment.captured" | "order.paid") =>
      sendSignedWebhook(webhookPayload(event, { orderId, paymentId, amountPaise: shop.plain.price * 2 * 100 }));
    const results = await Promise.all([verify(), hook("payment.captured"), verify(), hook("order.paid"), verify()]);
    for (const r of results) expect("status" in r && typeof r.status === "function" ? r.status() : (r as { status: number }).status, `round ${round}`).toBe(200);

    const orders = await d.collection("orders").find({ razorpayOrderId: orderId }).toArray();
    expect(orders, `round ${round}: orders`).toHaveLength(1);
    expect(orders[0]).toMatchObject({ paymentStatus: "PAID", stockSettled: true, razorpayPaymentId: paymentId });
    expect(["verify-payment", "webhook"]).toContain(orders[0].finalizedVia);
    stock -= 2;
    const product = await d.collection("products").findOne({ _id: oid(shop.plain.id) });
    expect(product!.stockQuantity, `round ${round}: stock`).toBe(stock);
  }
  expect(await d.collection("orders").countDocuments({})).toBe(12);
  const r = redis();
  for (const id of created) await r.del(`pending_order_${id}`);
  await ctx.close();
});

// ── the admin's "Needs review" note ───────────────────────────────────────────

const LONG = "x".repeat(180); // an unbroken string (an id, a URL) must wrap, never overflow
const baseOrder = (over: Record<string, unknown>) => {
  const now = new Date();
  return {
    userId: oid(customerA), status: "PROCESSING", paymentStatus: "PAID", totalAmount: 600, subtotal: 600, shippingCost: 0, taxAmount: 0, discountAmount: 0,
    items: [{ productId: oid(shop.sized.id), name: shop.sized.name, quantity: 1, priceAtPurchase: 600, image: "", selectedSize: "M" }],
    customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233",
    shippingAddress: { street: "12 Test Lane", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
    stockSettled: true, createdAt: now, updatedAt: now, ...over,
  };
};

async function openFirstOrder(page: Page, who: RegExp | string) {
  await page.goto("/admin/orders");
  const row = page.getByRole("row").filter({ hasText: who }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByText("Ada Customer").click();
  await expect(page.getByTestId("review-note").first()).toBeVisible();
}

const WIDTHS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 820, height: 1100 },
  { name: "phone", width: 390, height: 844 },
];

test.describe("the Needs review note", () => {
  test.beforeEach(async () => {
    shop = await resetShop();
    const d = await db();
    await d.collection("orders").deleteMany({});
    await plainIndex(); // older duplicates exist only where the index is not unique
  });

  for (const vp of WIDTHS) {
    test(`same payment recorded twice: plain wording, long text stays inside its box and clear of the Pay ID card (${vp.name})`, async ({ browser }) => {
      const d = await db();
      const oldNote = `Possible duplicate payment: the same account paid for the same items in order #ABC123 less than 30 minutes earlier. Check with the customer before shipping both; refund one in Razorpay if it is a mistake. Amount mismatch: Razorpay reports ₹1.00 paid. Reference ${LONG}`;
      const pair = { razorpayOrderId: "order_pair", razorpayPaymentId: `pay_${LONG.slice(0, 60)}`, reviewNote: oldNote };
      await d.collection("orders").insertMany([
        baseOrder({ ...pair, finalizedVia: "webhook", finalizedAt: new Date() }),
        baseOrder({ ...pair, finalizedVia: "verify-payment", finalizedAt: new Date(), createdAt: new Date(Date.now() - 1000) }),
      ]);
      const admin = await newContext(browser, "admin");
      const page = await admin.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openFirstOrder(page, "Ada Customer");

      const note = page.getByTestId("review-note").first();
      await expect(note).toContainText("The same payment was recorded twice");
      await expect(note).toContainText("Ship only ONE");
      await expect(note).not.toContainText("Possible duplicate payment");
      await expect(note).toContainText("Amount mismatch"); // the rest of the note is kept

      // the order's own small text
      await expect(page.getByTestId("finalized-via").first()).toContainText(/Order created by (the Razorpay webhook|the customer's browser confirmation)/);

      // nothing overflows: the box, its text, the page
      const sizes = await note.evaluate((box) => {
        const p = box.querySelector("p:last-child")!;
        const r = box.getBoundingClientRect();
        const parent = box.parentElement!.getBoundingClientRect();
        return { boxScroll: box.scrollWidth, boxClient: box.clientWidth, pScroll: p.scrollWidth, pClient: p.clientWidth, right: r.right, parentRight: parent.right + 0.5, pageScroll: document.documentElement.scrollWidth, pageClient: document.documentElement.clientWidth };
      });
      expect(sizes.boxScroll).toBeLessThanOrEqual(sizes.boxClient + 1);
      expect(sizes.pScroll).toBeLessThanOrEqual(sizes.pClient + 1);
      expect(sizes.right).toBeLessThanOrEqual(sizes.parentRight);
      expect(sizes.pageScroll).toBeLessThanOrEqual(sizes.pageClient + 1);

      // the note and the Gateway Details (Pay ID) card never overlap
      const card = page.getByText("Gateway Details").first().locator("xpath=..");
      await card.scrollIntoViewIfNeeded();
      const [a, b] = await Promise.all([note.boundingBox(), card.boundingBox()]);
      const overlap = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
      expect(overlap, "note and Pay ID card overlap").toBe(false);
      // and the Pay ID itself stays inside its own card
      const payId = await card.evaluate((c) => ({ scroll: c.scrollWidth, client: c.clientWidth }));
      expect(payId.scroll).toBeLessThanOrEqual(payId.client + 1);
      await admin.close();
    });
  }

  test("different payments, same items: keeps the existing 'possible duplicate' wording", async ({ browser }) => {
    const d = await db();
    const note = "Possible duplicate payment: the same account paid for the same items in order #ABC123 less than 30 minutes earlier. Check with the customer before shipping both; refund one in Razorpay if it is a mistake.";
    await d.collection("orders").insertOne(baseOrder({ razorpayOrderId: "order_solo", razorpayPaymentId: "pay_solo", reviewNote: note }));
    const admin = await newContext(browser, "admin");
    const page = await admin.newPage();
    await openFirstOrder(page, "Ada Customer");
    await expect(page.getByTestId("review-note").first()).toContainText("Possible duplicate payment: the same account paid for the same items");
    await expect(page.getByTestId("review-note").first()).not.toContainText("recorded twice");
    await expect(page.getByTestId("finalized-via")).toHaveCount(0); // older orders carry no path/time
    await admin.close();
  });
});

test.describe("dashboard warning about the orders index", () => {
  test("nothing is shown when the check is fine, and a clear warning when it is not", async ({ browser }) => {
    const admin = await newContext(browser, "admin");
    const page = await admin.newPage();
    await page.route("**/api/admin/health", (route) => route.fulfill({ json: { ordersIndex: { ok: true, problem: null } } }));
    await page.goto("/admin");
    await expect(page.getByTestId("refunds-pending-status")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("db-index-warning")).toHaveCount(0);

    await page.unroute("**/api/admin/health");
    await page.route("**/api/admin/health", (route) => route.fulfill({ json: { ordersIndex: { ok: false, problem: "the index razorpayOrderId_1 is not unique and sparse" } } }));
    await page.reload();
    const warning = page.getByTestId("db-index-warning");
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await expect(warning).toContainText("not unique and sparse");
    await expect(warning).toContainText("npm run ensure:indexes");
    await admin.close();
  });
});

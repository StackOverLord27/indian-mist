import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { resetShop, product, ordersFor, reservations, closeDb, db, oid, type Seeded } from "./support/db.ts";
import { newContext, putInBag, openCheckout } from "./support/shop.ts";
import {
  startPayment, enterCard, submitCard, chooseOutcome, dismissCheckout, trackRazorpayOrders, cleanRedis, resetCheckoutLimits, checkoutClosed,
  webhookPayload, sendSignedWebhook, REAL_WEBHOOK, checkoutFrame,
} from "./support/razorpay.ts";

let shop: Seeded;

test.beforeEach(async () => {
  shop = await resetShop();
  await resetCheckoutLimits();
});
test.afterAll(async () => {
  await cleanRedis();
  await closeDb();
});

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const stockOf = async (p: { id: string }) => (await product(p.id)).stockQuantity as number;
const sizeQty = async (p: { id: string }, size: string) => ((await product(p.id)).sizeStock as { size: string; quantity: number }[]).find((s) => s.size === size)!.quantity;

/** Opens a signed-in browser on the checkout page with the given bag. */
async function shopper(browser: Browser, who: "customer-a" | "customer-b", lines: Parameters<typeof putInBag>[1]) {
  const ctx = await newContext(browser, who);
  const page = await ctx.newPage();
  trackRazorpayOrders(page);
  await putInBag(page, lines);
  await openCheckout(page);
  return { ctx, page };
}

/** Pays with the test card through the real Checkout window and waits for the browser confirmation. */
async function paySuccessfully(page: Page, ctx: BrowserContext) {
  const { body } = await startPayment(page);
  await enterCard(page);
  const verified = page.waitForResponse((r) => r.url().endsWith("/api/checkout/verify-payment"));
  const bank = await submitCard(page, ctx);
  await chooseOutcome(bank, "Success");
  const res = await verified;
  if (res.status() !== 200) console.log("VERIFY FAILED:", res.status(), await res.text(), "order", body.razorpayOrderId);
  return { razorpayOrderId: body.razorpayOrderId as string, verifyStatus: res.status() };
}

/** Waits until an order for this Razorpay order id exists in the database. */
async function waitForOrder(razorpayOrderId: string, timeout = 90_000) {
  await expect.poll(async () => (await ordersFor(razorpayOrderId)).length, { timeout, intervals: [500, 1000, 2000] }).toBe(1);
  return (await ordersFor(razorpayOrderId))[0];
}
/** Waits for a stock hold to reach a status. */
async function waitForHold(status: string, timeout = 20_000) {
  await expect.poll(async () => (await reservations()).map((r) => r.status as string), { timeout }).toEqual([status]);
}
const shortId = (order: { _id: unknown }) => String(order._id).slice(-6).toUpperCase();

test("1. successful card payment through the real Razorpay Checkout window", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.sized, size: "M", quantity: 2 }]);
  const { razorpayOrderId, verifyStatus } = await paySuccessfully(page, ctx);
  expect(verifyStatus).toBe(200);
  await expect(page.getByRole("heading", { name: "Order Placed!" })).toBeVisible();

  // exactly one PAID/PROCESSING order (the browser confirmation and Razorpay's own webhook may both arrive)
  const order = await waitForOrder(razorpayOrderId);
  expect(order).toMatchObject({ paymentStatus: "PAID", status: "PROCESSING", totalAmount: 1200 }); // 2 x 600, free shipping over 999
  expect(await ordersFor(razorpayOrderId)).toHaveLength(1);
  expect(await sizeQty(shop.sized, "M")).toBe(1);
  expect(await sizeQty(shop.sized, "S")).toBe(3);
  expect(await stockOf(shop.sized)).toBe(7);
  await waitForHold("CONSUMED");

  // the bag is empty
  const bag = await page.evaluate(() => JSON.parse(window.localStorage.getItem("indian-mist-cart") ?? "{}").state?.items ?? []);
  expect(bag).toEqual([]);

  // visible in the customer's profile
  await page.goto("/profile");
  await expect(page.getByText(shortId(order)).first()).toBeVisible({ timeout: 20_000 });

  // and in the admin orders list
  const admin = await newContext(browser, "admin");
  const adminPage = await admin.newPage();
  await adminPage.goto("/admin/orders");
  await expect(adminPage.getByText(shortId(order)).first()).toBeVisible({ timeout: 20_000 });
  await expect(adminPage.getByText("Ada Customer").first()).toBeVisible();
  await ctx.close();
  await admin.close();
});

test("2. failed payment: error shown, no order, stock back after dismissal, retry works", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.plain, quantity: 2 }]);
  const { body } = await startPayment(page);
  expect(await stockOf(shop.plain)).toBe(8); // held
  await enterCard(page);
  const bank = await submitCard(page, ctx);
  await chooseOutcome(bank, "Failure");

  await expect(page.getByText(/payment failed|failed/i).first()).toBeVisible({ timeout: 30_000 });
  expect(await ordersFor()).toHaveLength(0);

  await dismissCheckout(page);
  await waitForHold("RELEASED");
  await expect.poll(() => stockOf(shop.plain)).toBe(10); // the stock is returned just after the hold is marked released
  expect(await ordersFor()).toHaveLength(0);

  // the shopper can try again and pay
  const second = await paySuccessfully(page, ctx);
  expect(second.razorpayOrderId).not.toBe(body.razorpayOrderId);
  expect(second.verifyStatus).toBe(200);
  await waitForOrder(second.razorpayOrderId);
  expect(await stockOf(shop.plain)).toBe(8);
  await ctx.close();
});

test("3. closing the payment window without paying releases the hold at once", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.last, quantity: 1 }]);
  await startPayment(page);
  expect(await stockOf(shop.last)).toBe(0); // the last unit is held
  await dismissCheckout(page);
  await expect(page.getByText("Payment cancelled").first()).toBeVisible();
  await waitForHold("RELEASED");
  await expect.poll(() => stockOf(shop.last)).toBe(1); // back on sale immediately
  expect(await ordersFor()).toHaveLength(0);
  await ctx.close();
});

test("4. paid, but the browser's confirmation never arrives: the webhook creates the order", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.sized, size: "S", quantity: 1 }]);
  let captured: { razorpayOrderId: string; razorpayPaymentId: string } | null = null;
  await page.route("**/api/checkout/verify-payment", (route) => {
    captured = route.request().postDataJSON();
    return route.abort(); // the tab "was closed" before the confirmation got through
  });
  const { body } = await startPayment(page);
  await enterCard(page);
  const bank = await submitCard(page, ctx);
  await chooseOutcome(bank, "Success");
  await expect.poll(() => captured, { timeout: 60_000 }).not.toBeNull();

  if (!REAL_WEBHOOK) {
    const res = await sendSignedWebhook(webhookPayload("payment.captured", { orderId: captured!.razorpayOrderId, paymentId: captured!.razorpayPaymentId, amountPaise: body.amount }));
    expect(res.status).toBe(200);
  }
  const order = await waitForOrder(body.razorpayOrderId); // with E2E_REAL_WEBHOOK=1 this is Razorpay's own delivery
  expect(order).toMatchObject({ paymentStatus: "PAID", razorpayPaymentId: captured!.razorpayPaymentId });
  expect(await sizeQty(shop.sized, "S")).toBe(2);
  await waitForHold("CONSUMED");

  await page.unroute("**/api/checkout/verify-payment");
  await page.goto("/profile");
  await expect(page.getByText(shortId(order)).first()).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

test("5a. browser confirmation first, then webhooks (including repeats): one order, stock settled once", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.plain, quantity: 3 }]);
  const { razorpayOrderId, verifyStatus } = await paySuccessfully(page, ctx);
  expect(verifyStatus).toBe(200);
  const order = await waitForOrder(razorpayOrderId);
  const paymentId = order.razorpayPaymentId as string;

  const pay = { orderId: razorpayOrderId, paymentId, amountPaise: Math.round((order.totalAmount as number) * 100) };
  for (const event of ["payment.captured", "order.paid", "payment.captured"] as const) {
    expect((await sendSignedWebhook(webhookPayload(event, pay))).status).toBe(200);
  }
  expect(await ordersFor(razorpayOrderId)).toHaveLength(1);
  expect(await stockOf(shop.plain)).toBe(7); // 10 - 3, once
  await waitForHold("CONSUMED");
  await ctx.close();
});

test("5b. webhook first, then the browser confirmation: one order, stock settled once", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.plain, quantity: 2 }]);
  let verifyStatus = 0;
  await page.route("**/api/checkout/verify-payment", async (route) => {
    const ids = route.request().postDataJSON() as { razorpayOrderId: string; razorpayPaymentId: string };
    // hold the browser's confirmation back until the webhook has created the order
    if (!REAL_WEBHOOK) {
      const pay = { orderId: ids.razorpayOrderId, paymentId: ids.razorpayPaymentId, amountPaise: 0 };
      expect((await sendSignedWebhook(webhookPayload("order.paid", pay))).status).toBe(200);
    }
    await waitForOrder(ids.razorpayOrderId);
    const res = await route.fetch();
    verifyStatus = res.status();
    await route.fulfill({ response: res });
  });
  const { body } = await startPayment(page);
  await enterCard(page);
  const bank = await submitCard(page, ctx);
  await chooseOutcome(bank, "Success");

  await expect(page.getByRole("heading", { name: "Order Placed!" })).toBeVisible({ timeout: 90_000 });
  expect(verifyStatus).toBe(200);
  expect(await ordersFor(body.razorpayOrderId)).toHaveLength(1);
  expect(await stockOf(shop.plain)).toBe(8);
  await waitForHold("CONSUMED");
  await ctx.close();
});

test("6. promo code: discount in the Razorpay amount, and the per-user limit blocks a second use", async ({ browser }) => {
  const { ctx, page } = await shopper(browser, "customer-a", [{ product: shop.plain, quantity: 3 }]); // 1200
  await page.getByPlaceholder("Enter code").fill(shop.promoCode.toLowerCase());
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/Coupon applied/i).first()).toBeVisible();

  const { status, body } = await startPayment(page);
  expect(status).toBe(200);
  expect(body.amount).toBe(108000); // 1200 - 10% = 1080 rupees, in paise
  await expect(checkoutFrame(page).locator("body")).toContainText("1,080");
  await enterCard(page);
  const verified = page.waitForResponse((r) => r.url().endsWith("/api/checkout/verify-payment"));
  await chooseOutcome(await submitCard(page, ctx), "Success");
  expect((await verified).status()).toBe(200);
  const order = await waitForOrder(body.razorpayOrderId);
  expect(order).toMatchObject({ promoCode: "E2E10", discountAmount: 120, totalAmount: 1080 });

  // a second use by the same customer is refused
  await page.evaluate((item) => {
    window.localStorage.setItem("indian-mist-cart", JSON.stringify({ state: { items: [item] }, version: 0 }));
  }, { id: shop.plain.id, slug: shop.plain.slug, name: shop.plain.name, category: "e2e-tees", price: 400, image: "https://placehold.co/400x500/png", quantity: 3 });
  await page.goto("/checkout");
  await expect(page.getByPlaceholder("you@example.com")).not.toHaveValue("", { timeout: 20_000 });
  await page.getByPlaceholder("Enter code").fill(shop.promoCode);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/already used this promo code/i).first()).toBeVisible();
  await ctx.close();
});

test("7. two shoppers race for the last unit: one succeeds, the other gets a clear message", async ({ browser }) => {
  const a = await shopper(browser, "customer-a", [{ product: shop.last, quantity: 1 }]);
  const b = await shopper(browser, "customer-b", [{ product: shop.last, quantity: 1 }]);
  const [ra, rb] = await Promise.all([startPayment(a.page), startPayment(b.page)]);
  const results = [ra.status, rb.status].sort();
  expect(results).toEqual([200, 400]);
  const [winner, loser] = ra.status === 200 ? [a, b] : [b, a];
  const lost = ra.status === 200 ? rb : ra;
  expect(lost.body.message).toMatch(/out of stock|only 0 left|sold out/i);
  await expect(loser.page.getByText(/out of stock/i).first()).toBeVisible();
  expect(await stockOf(shop.last)).toBe(0); // never negative
  expect(await reservations()).toHaveLength(1);

  // the winner walks away: the unit is available again, and the other shopper can now buy it
  await dismissCheckout(winner.page);
  await waitForHold("RELEASED");
  await expect.poll(() => stockOf(shop.last)).toBe(1);
  const retry = await startPayment(loser.page);
  expect(retry.status).toBe(200);
  await dismissCheckout(loser.page);
  await a.ctx.close();
  await b.ctx.close();
});

test("8. bag out of date: sync messages appear and the charged amount is the server's", async ({ browser }) => {
  // the shopper put 3 x M in the bag at 500 each; since then the price became 650 and only 1 is left
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  trackRazorpayOrders(page);
  await putInBag(page, [{ product: shop.sized, size: "M", quantity: 3, price: 500, maxQuantity: 3 }]);
  const d = await db();
  await d.collection("products").updateOne({ _id: oid(shop.sized.id) }, { $set: { price: 650, "sizeStock.$[m].quantity": 1, stockQuantity: 7 } }, { arrayFilters: [{ "m.size": "M" }] });

  await openCheckout(page);
  await expect(page.getByText(/price of E2E Sized Tee changed/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Only 1 of E2E Sized Tee available/i).first()).toBeVisible();
  await expect(page.getByText(/Checkout/).first()).toBeVisible();

  const { status, body } = await startPayment(page);
  expect(status).toBe(200);
  expect(body.amount).toBe(74900); // 1 x 650 + 99 shipping, from the server's own price and stock
  expect(body.amount).not.toBe(Math.round((500 * 3 + 0) * 100));
  await expect(checkoutFrame(page).locator("body")).toContainText("749");
  await dismissCheckout(page);
  await waitForHold("RELEASED");
  await expect.poll(() => sizeQty(shop.sized, "M")).toBe(1);

  // asking for more than is left is refused by the server even if the browser is tricked
  const tooMany = await page.evaluate(async (args) => {
    const res = await fetch("/api/checkout/create-order", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ productId: args.id, quantity: 3, size: "M" }], customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233", shippingAddress: { street: "12 Test Lane", city: "Pune", state: "Maharashtra", zipCode: "411001" } }),
    });
    return { status: res.status, body: await res.json() };
  }, { id: shop.sized.id });
  expect(tooMany.status).toBe(400);
  expect(tooMany.body.message).toMatch(/only 1 left/i);
  expect(await sizeQty(shop.sized, "M")).toBe(1);
  await ctx.close();
});

test("9. admin cancels a paid order: stock restored once, a second cancel changes nothing", async ({ browser }) => {
  const admin = await newContext(browser, "admin");
  const adminPage = await admin.newPage();

  // two paid orders for the plain cap (1 and 2 units): stock 10 -> 7
  const first = await shopper(browser, "customer-a", [{ product: shop.plain, quantity: 1 }]);
  const one = await paySuccessfully(first.page, first.ctx);
  const orderOne = await waitForOrder(one.razorpayOrderId);
  await first.page.evaluate((item) => {
    window.localStorage.setItem("indian-mist-cart", JSON.stringify({ state: { items: [item] }, version: 0 }));
  }, { id: shop.plain.id, slug: shop.plain.slug, name: shop.plain.name, category: "e2e-tees", price: 400, image: "https://placehold.co/400x500/png", quantity: 2 });
  await first.page.goto("/checkout");
  await expect(first.page.getByPlaceholder("you@example.com")).not.toHaveValue("", { timeout: 20_000 });
  const two = await (async () => { const { fillShipping } = await import("./support/shop.ts"); await fillShipping(first.page); return paySuccessfully(first.page, first.ctx); })();
  const orderTwo = await waitForOrder(two.razorpayOrderId);
  expect(await stockOf(shop.plain)).toBe(7);

  // (a) cancel order one in the admin UI, then try again
  await adminPage.goto("/admin/orders");
  const row = adminPage.getByRole("row").filter({ hasText: shortId(orderOne) });
  await row.getByRole("button", { name: /PROCESSING/i }).click();
  await adminPage.getByRole("menuitem", { name: "Cancelled" }).click();
  await expect(adminPage.getByText("Order status updated").first()).toBeVisible();
  await expect.poll(() => stockOf(shop.plain)).toBe(8);
  expect((await ordersFor(one.razorpayOrderId))[0].status).toBe("CANCELLED");

  const again = adminPage.getByRole("row").filter({ hasText: shortId(orderOne) });
  await again.getByRole("button", { name: /CANCELLED/i }).click();
  await adminPage.getByRole("menuitem", { name: "Cancelled" }).click();
  await expect(adminPage.getByText(/cancelled order cannot be changed/i).first()).toBeVisible();
  expect(await stockOf(shop.plain)).toBe(8); // not 9

  // (b) a double click on order two: two requests at the same moment
  const statuses = await adminPage.evaluate(async (id) => {
    const call = () => fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }) }).then((r) => r.status);
    return Promise.all([call(), call(), call()]);
  }, String(orderTwo._id));
  expect([...statuses].sort()).toEqual([200, 409, 409]);
  expect(await stockOf(shop.plain)).toBe(10); // 8 + 2, once
  await first.ctx.close();
  await admin.close();
});

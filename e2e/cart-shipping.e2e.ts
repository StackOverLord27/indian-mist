import { test, expect } from "@playwright/test";
import { db, closeDb, resetShop } from "./support/db.ts";
import { newContext, putInBag, openCheckout, payButton } from "./support/shop.ts";

// The customer-facing shipping numbers come from the owner's saved pricing settings (the same ones
// the server charges), in the cart, the mobile sticky total and the checkout, and nothing wrong is
// shown while they load.

let shop: Awaited<ReturnType<typeof resetShop>>;

test.beforeAll(async () => {
  shop = await resetShop();
  const d = await db();
  // The owner's numbers: NOT the 999 / 99 the code keeps as the server's last resort
  await d.collection("sitesettings").updateOne({}, { $set: { "pricingSettings.freeShippingThreshold": 700, "pricingSettings.shippingCost": 70 } });
});
test.afterAll(() => closeDb());

test("cart and checkout use the saved threshold (700) and fee (70), not the built-in 999 / 99", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await putInBag(page, [{ product: shop.plain }]); // price 400
  await page.goto("/cart");
  // 700 - 400 = 300 (the old built-in 999 would have said 599)
  await expect(page.getByText("Add ₹300 more for free shipping")).toBeVisible();
  await expect(page.getByText("Add ₹599")).toHaveCount(0);
  const summary = page.locator("div").filter({ has: page.getByRole("heading", { name: "Order Summary" }) }).first();
  await expect(summary.getByText("₹70", { exact: true })).toBeVisible();   // shipping
  await expect(summary.getByText("₹470", { exact: true })).toBeVisible();  // total = 400 + 70

  // mobile: the sticky total shows the same ₹470 (it used to show the bare subtotal)
  // (the bar appears once the page's own checkout button is out of view: a short window and a scroll to the top)
  await page.setViewportSize({ width: 390, height: 320 });
  await page.goto("/cart");
  await expect(page.locator("div.fixed").getByText("₹470", { exact: true })).toBeVisible();

  // the checkout page agrees
  await page.setViewportSize({ width: 1280, height: 900 });
  await openCheckout(page);
  await expect(payButton(page)).toContainText("₹470");
  await ctx.close();
});

test("above the saved threshold shipping is free and the bar is gone", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await putInBag(page, [{ product: shop.plain, quantity: 2 }]); // 800 >= 700
  await page.goto("/cart");
  await expect(page.getByText("✓ Free shipping unlocked")).toBeVisible();
  await expect(page.getByText(/more for free shipping/)).toHaveCount(0);
  await expect(page.getByText("₹800", { exact: true }).first()).toBeVisible();
  await ctx.close();
});

test("while the settings load there is no shipping number, no bar and no total; the numbers appear when they arrive", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await putInBag(page, [{ product: shop.plain }]);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/settings", async (route) => { await gate; await route.continue(); });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
  await expect(page.getByText("Calculated at checkout")).toBeVisible();
  await expect(page.getByText(/more for free shipping/)).toHaveCount(0);
  await expect(page.getByText("₹99", { exact: true })).toHaveCount(0);
  await expect(page.getByText("₹499", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText("Add ₹300 more for free shipping")).toBeVisible();
  await expect(page.getByText("Calculated at checkout")).toHaveCount(0);
  await ctx.close();
});

test("if the settings cannot be loaded the cart stays neutral instead of guessing, and checkout cannot be paid", async ({ browser }) => {
  const ctx = await newContext(browser, "customer-a");
  const page = await ctx.newPage();
  await putInBag(page, [{ product: shop.plain }]);
  await page.route("**/api/settings", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.goto("/cart");
  await expect(page.getByText("Calculated at checkout")).toBeVisible();
  await expect(page.getByText(/more for free shipping/)).toHaveCount(0);
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(page.getByText("Calculating…")).toBeVisible();
  await expect(payButton(page)).toBeDisabled();
  await ctx.close();
});

import { test, expect, type Page } from "@playwright/test";
import { db, closeDb, oid, resetShop, seedUsers, type Seeded } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

/**
 * The admin's side of the customer e-mails, in the real built app. The runner points SMTP at a dead
 * port with EMAIL_ENABLED=false (e2e/serve.mjs), so no e-mail leaves the machine: what is tested
 * here is what the admin sees and what is saved. The e-mails' content and sending are unit-tested
 * against a local fake SMTP server (tests/order-emails.test.ts).
 */

let shop: Seeded;
let customerA = "";
test.beforeAll(async () => { customerA = (await seedUsers()).customerA; });
test.afterAll(async () => { await closeDb(); });

const order = (over: Record<string, unknown> = {}) => {
  const now = new Date();
  return {
    userId: oid(customerA), status: "PROCESSING", paymentStatus: "PAID", totalAmount: 600, subtotal: 600, shippingCost: 0, taxAmount: 0, discountAmount: 0,
    items: [{ productId: oid(shop.sized.id), name: shop.sized.name, quantity: 1, priceAtPurchase: 600, image: "", selectedSize: "M" }],
    customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233",
    shippingAddress: { street: "12 Test Lane", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
    razorpayOrderId: `order_em_${Math.random().toString(36).slice(2, 8)}`, stockSettled: true, createdAt: now, updatedAt: now, ...over,
  };
};

const log = (orderId: unknown, type: string, over: Record<string, unknown> = {}) => ({
  type, dedupeKey: `${type}:${String(orderId)}`, relatedId: String(orderId), status: "sent", attempts: 1, permanent: false,
  sentAt: new Date(), createdAt: new Date(), updatedAt: new Date(), ...over,
});

async function openOrder(page: Page) {
  await page.goto("/admin/orders");
  const row = page.getByRole("row").filter({ hasText: "Ada Customer" }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByText("Ada Customer").click();
  await expect(page.getByTestId("order-emails")).toBeVisible();
}

test.beforeEach(async () => {
  shop = await resetShop();
  const d = await db();
  await d.collection("emaillogs").deleteMany({});
});

const WIDTHS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

for (const vp of WIDTHS) {
  test(`the order detail lists the e-mails (sent, failed for good, will retry, queued), with Resend only where it applies (${vp.name})`, async ({ browser }) => {
    const d = await db();
    const id = oid();
    await d.collection("orders").insertOne({ ...order(), _id: id });
    await d.collection("emaillogs").insertMany([
      log(id, "order-confirmation"),
      log(id, "order-shipped", { status: "failed", permanent: true, lastErrorCode: "550", attempts: 1, sentAt: undefined }),
      log(id, "order-cancelled", { status: "failed", permanent: false, lastErrorCode: "ESOCKET", attempts: 2, nextAttemptAt: new Date(Date.now() + 60_000) }),
      log(id, "order-delivered", { status: "queued", attempts: 0, sentAt: undefined }),
    ]);
    const admin = await newContext(browser, "admin");
    const page = await admin.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openOrder(page);

    const panel = page.getByTestId("order-emails");
    await expect(panel).toContainText("Order confirmation");
    const row = (label: string) => panel.getByRole("listitem").filter({ hasText: label });
    await expect(row("Order confirmation")).toContainText("sent");
    await expect(row("Order confirmation").getByRole("button", { name: "Resend" })).toHaveCount(0);
    await expect(row("Shipped")).toContainText("failed for good");
    await expect(row("Shipped")).toContainText("550");
    await expect(row("Shipped").getByRole("button", { name: "Resend" })).toBeVisible();
    await expect(row("Cancelled")).toContainText("failed, will retry");
    await expect(row("Cancelled").getByRole("button", { name: "Resend" })).toBeVisible();
    await expect(row("Delivered")).toContainText("queued");
    await expect(row("Delivered").getByRole("button", { name: "Resend" })).toHaveCount(0);
    // the customer's address is never shown in this list
    await expect(panel).not.toContainText("@");

    const fits = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(fits.scroll).toBeLessThanOrEqual(fits.client + 1);
    const box = await panel.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
    await admin.close();
  });
}

test("Resend on a failed e-mail answers plainly when nothing can be sent (mail is switched off in this run) and the list stays correct", async ({ browser }) => {
  const d = await db();
  const id = oid();
  await d.collection("orders").insertOne({ ...order(), _id: id });
  await d.collection("emaillogs").insertOne(log(id, "order-shipped", { status: "failed", permanent: true, lastErrorCode: "550", sentAt: undefined }));
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await openOrder(page);
  const responded = page.waitForResponse((r) => /\/api\/admin\/emails\/[a-f0-9]{24}\/resend$/.test(r.url()));
  await page.getByTestId("order-emails").getByRole("button", { name: "Resend" }).click();
  // EMAIL_ENABLED=false in the e2e server: the guard refuses and says so plainly; nothing is delivered
  const res = await responded;
  expect(res.status()).toBe(409);
  expect(JSON.stringify(await res.json())).toMatch(/switched off|not allowed/);
  await expect(page.getByText(/switched off, or this deployment is not allowed/)).toBeVisible();
  const rows = await d.collection("emaillogs").find({}).toArray();
  expect(rows).toHaveLength(1);
  expect(rows[0].lastErrorCode).toBe("EGUARD");
  await admin.close();
});

test("choosing Shipped with courier, tracking number and link saves them; the customer sees them in My Orders", async ({ browser }) => {
  const d = await db();
  const id = oid();
  await d.collection("orders").insertOne({ ...order(), _id: id });
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await openOrder(page);

  await page.getByLabel("Courier").fill("Delhivery");
  await page.getByLabel("Tracking number").fill("DL123456789");
  await page.getByLabel("Tracking link").fill("https://track.example.test/DL123456789");
  const saved = page.waitForResponse((r) => r.url().includes(`/api/admin/orders/${String(id)}/status`) && r.request().method() === "PATCH");
  await page.getByRole("row").filter({ hasText: "Ada Customer" }).first().getByRole("button", { name: /PROCESSING/ }).click();
  await page.getByRole("menuitem", { name: "Shipped" }).click();
  expect((await saved).status()).toBe(200);

  const stored = await d.collection("orders").findOne({ _id: id });
  expect(stored).toMatchObject({ status: "SHIPPED", courier: "Delhivery", trackingNumber: "DL123456789", trackingUrl: "https://track.example.test/DL123456789" });
  await admin.close();

  const customer = await newContext(browser, "customer-a");
  const cp = await customer.newPage();
  await cp.goto("/profile");
  await cp.getByRole("button", { name: "Expand order" }).first().click();
  const box = cp.getByTestId("order-tracking");
  await expect(box).toContainText("Delhivery");
  await expect(box).toContainText("DL123456789");
  await expect(box.getByRole("link", { name: "Track your parcel" })).toHaveAttribute("href", "https://track.example.test/DL123456789");
  await customer.close();
});

test("an invalid tracking link never blocks Shipped: the status changes and the admin is told what was left out", async ({ browser }) => {
  const d = await db();
  const id = oid();
  await d.collection("orders").insertOne({ ...order(), _id: id });
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await openOrder(page);
  await page.getByLabel("Courier").fill("Blue Dart");
  await page.getByLabel("Tracking link").fill("javascript:alert(1)");
  const saved = page.waitForResponse((r) => r.url().includes(`/api/admin/orders/${String(id)}/status`) && r.request().method() === "PATCH");
  await page.getByRole("row").filter({ hasText: "Ada Customer" }).first().getByRole("button", { name: /PROCESSING/ }).click();
  await page.getByRole("menuitem", { name: "Shipped" }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText(/were not valid and were left out: tracking link/)).toBeVisible();
  const stored = await d.collection("orders").findOne({ _id: id });
  expect(stored).toMatchObject({ status: "SHIPPED", courier: "Blue Dart" });
  expect(stored!.trackingUrl).toBeUndefined();
  await admin.close();
});

test("the settings page has the Delivered e-mail switch, off by default, and it is saved", async ({ browser }) => {
  const d = await db();
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto("/admin/settings");
  const box = page.getByRole("checkbox", { name: /Also e-mail the customer when an order is marked/ });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await expect(box).not.toBeChecked();
  await box.check();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/admin/settings") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Save Settings" }).click();
  expect((await saved).status()).toBe(200);
  const doc = await d.collection("sitesettings").findOne({});
  expect(doc!.emailSettings.sendDeliveredEmail).toBe(true);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Also e-mail the customer when an order is marked/ })).toBeChecked();
  await admin.close();
});

test("a link from the owner's e-mail (?order=<id>) opens that one order, expanded, with a way back to all orders", async ({ browser }) => {
  const d = await db();
  const id = oid();
  await d.collection("orders").insertMany([
    { ...order({ customerName: "Zed Other" }), _id: oid(), createdAt: new Date(Date.now() - 1000) },
    { ...order({ customerName: "Ada Customer" }), _id: id },
    { ...order({ customerName: "Yan Third" }), _id: oid(), createdAt: new Date(Date.now() - 2000) },
  ]);
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto(`/admin/orders?order=${String(id)}`);
  await expect(page.getByTestId("single-order-banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("order-emails")).toBeVisible(); // expanded at once
  await expect(page.getByRole("row").filter({ hasText: "Zed Other" })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Yan Third" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show all orders" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Zed Other" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Yan Third" })).toBeVisible();
  await expect(page.getByTestId("single-order-banner")).toHaveCount(0);
  await admin.close();
});

test("the settings page has the low-stock switch (off by default) and level, and they are saved", async ({ browser }) => {
  const d = await db();
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto("/admin/settings");
  const box = page.getByRole("checkbox", { name: /E-mail me when a product runs low on stock/ });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await expect(box).not.toBeChecked();
  await box.check();
  await page.getByRole("spinbutton").fill("5"); // the level (the only number field on this page)
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/admin/settings") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Save Settings" }).click();
  expect((await saved).status()).toBe(200);
  const doc = await d.collection("sitesettings").findOne({});
  expect(doc!.emailSettings).toMatchObject({ ownerLowStockAlert: true, lowStockThreshold: 5 });
  await admin.close();
});

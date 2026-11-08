import { test, expect } from "@playwright/test";
import { db, closeDb, oid, resetShop, seedUsers } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// Refunds are made by hand in Razorpay. The admin is reminded when cancelling a paid order, tracks
// it as "refund pending" / "refunded", and the customer sees a neutral status. The dashboard always
// shows the unmatched-payments check, with 0 when there is nothing.

let orderId = "";
let customerA = "";

test.beforeAll(async () => {
  const shop = await resetShop();
  customerA = (await seedUsers()).customerA;
  const d = await db();
  await Promise.all(["orders", "unmatchedpayments"].map((c) => d.collection(c).deleteMany({})));
  const now = new Date();
  const res = await d.collection("orders").insertOne({
    userId: oid(customerA), status: "PROCESSING", paymentStatus: "PAID", totalAmount: 600, subtotal: 600, shippingCost: 0, taxAmount: 0, discountAmount: 0,
    items: [{ productId: oid(shop.sized.id), name: shop.sized.name, quantity: 1, priceAtPurchase: 600, image: "", selectedSize: "M" }],
    customerName: "Ada Customer", email: "e2e-customer-a@example.test", phone: "9811122233",
    shippingAddress: { street: "12 Test Lane", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
    razorpayOrderId: `order_refund_${Date.now()}`, razorpayPaymentId: "pay_refund_test", stockSettled: true, createdAt: now, updatedAt: now,
  });
  orderId = String(res.insertedId);
});
test.afterAll(() => closeDb());

test("dashboard: the unmatched-payments check is visible with 0, and turns into an alert when there is one", async ({ browser }) => {
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto("/admin");
  const status = page.getByTestId("unmatched-payments-status");
  await expect(status).toContainText("Payments received without an order:");
  await expect(status).toContainText("0");
  await expect(page.getByTestId("refunds-pending-status")).toContainText("Refunds waiting for you:");
  await expect(page.getByTestId("refunds-pending-status")).toContainText("Nothing to refund.");

  const d = await db();
  await d.collection("unmatchedpayments").insertOne({ razorpayOrderId: "order_unmatched_1", razorpayPaymentId: "pay_unmatched_1", amount: 499, source: "webhook", seen: 1, createdAt: new Date(), updatedAt: new Date() });
  await page.reload();
  await expect(page.getByText("1 payment received without an order")).toBeVisible();
  await expect(page.getByText("pay_unmatched_1")).toBeVisible();
  await expect(page.getByTestId("unmatched-payments-status")).toHaveCount(0);

  // "Mark resolved" asks first, then the row leaves the list and the box shows 0 again
  page.once("dialog", (dialog) => { expect(dialog.message()).toContain("refunded it in Razorpay"); void dialog.accept(); });
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByTestId("unmatched-payments-status")).toContainText("0");
  expect(await d.collection("unmatchedpayments").findOne({ razorpayPaymentId: "pay_unmatched_1" })).toMatchObject({ resolvedManually: true });
  await d.collection("unmatchedpayments").deleteMany({});
  await admin.close();
});

test("cancelling a paid order reminds about the refund, lists it as pending, and the admin records the refund; the customer sees neutral states", async ({ browser }) => {
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto("/admin/orders");
  const row = page.getByRole("row").filter({ hasText: "Ada Customer" });
  await expect(row).toBeVisible({ timeout: 20_000 });

  // The cancel asks first and says the refund is not automatic
  let dialogText = "";
  page.once("dialog", (dialog) => { dialogText = dialog.message(); void dialog.accept(); });
  await row.getByRole("button", { name: /PROCESSING/ }).click();
  await page.getByRole("menuitem", { name: "Cancelled" }).click();
  await expect(page.getByText(/Remember to refund ₹600 in the Razorpay dashboard/)).toBeVisible();
  expect(dialogText).toContain("NOT refunded automatically");
  expect(dialogText).toContain("₹600");

  // Listed as refund pending: badge and tab
  await expect(row.getByText("Refund pending")).toBeVisible();
  await expect(page.getByRole("button", { name: /Refund pending\s*\(1\)/ })).toBeVisible();
  await page.getByRole("button", { name: /Refund pending\s*\(1\)/ }).click();
  await expect(page.getByRole("row").filter({ hasText: "Ada Customer" })).toBeVisible();

  // The dashboard reminds about it too
  const dash = await admin.newPage();
  await dash.goto("/admin");
  await expect(dash.getByTestId("refunds-pending-status")).toContainText("1");
  await expect(dash.getByTestId("refunds-pending-status")).toContainText("Refund pending");

  // The customer sees "Cancelled, refund in progress" (and no notes)
  const customer = await newContext(browser, "customer-a");
  const cp = await customer.newPage();
  await cp.goto("/profile");
  // (the label is also written under the order number for phones: look at the visible one)
  await expect(cp.getByText("Cancelled, refund in progress").filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });

  // The admin records the refund by hand
  await page.getByRole("row").filter({ hasText: "Ada Customer" }).click(); // expand
  await expect(page.getByRole("alert").filter({ hasText: "not refunded automatically" })).toBeVisible();
  await page.getByLabel("Status").selectOption("REFUNDED");
  await page.getByPlaceholder("rfnd_...").fill("rfnd_TEST1234");
  await page.getByLabel("Note (optional, only you see it)").fill("Refunded in the dashboard");
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/admin/orders/${orderId}/refund`) && r.request().method() === "PATCH"),
    page.getByRole("button", { name: "Save refund details" }).click(),
  ]);
  expect(res.status()).toBe(200);
  await expect(page.getByRole("button", { name: /Refund pending\s*\(0\)/ })).toBeVisible();

  const d = await db();
  const saved = await d.collection("orders").findOne({ _id: oid(orderId) });
  expect(saved).toMatchObject({ refundStatus: "REFUNDED", razorpayRefundId: "rfnd_TEST1234", refundNote: "Refunded in the dashboard", status: "CANCELLED" });

  await dash.reload();
  await expect(dash.getByTestId("refunds-pending-status")).toContainText("Nothing to refund.");

  // The customer now sees "Refunded", without the note or the refund id
  await cp.reload();
  await expect(cp.getByText("Refunded", { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(cp.getByText("rfnd_TEST1234")).toHaveCount(0);
  await expect(cp.getByText("Refunded in the dashboard")).toHaveCount(0);
  await customer.close();
  await admin.close();
});

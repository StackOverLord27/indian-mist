import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { BASE_URL } from "./env.ts";

const require = createRequire(import.meta.url);

/** Razorpay's documented TEST MODE card: Visa debit "success" card. Any CVV and future expiry work. */
export const SUCCESS_CARD = "4100280000001007";

export const checkoutFrame = (page: Page) => page.frameLocator("iframe.razorpay-checkout-frame");

// ── Razorpay order ids created by a test, so the pending copies in Redis can be removed at the end
const created = new Set<string>();
export function trackRazorpayOrders(page: Page) {
  page.on("response", async (res) => {
    if (res.url().endsWith("/api/checkout/create-order") && res.status() === 200) {
      const body = await res.json().catch(() => null);
      if (body?.razorpayOrderId) created.add(body.razorpayOrderId);
    }
  });
}
export async function cleanRedis() {
  const { Redis } = require("@upstash/redis");
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  for (const id of created) await redis.del(`pending_order_${id}`);
  created.clear();
  await resetCheckoutLimits();
}

/**
 * The "checkouts started per hour" counters (10 per account, 30 per address): a full run starts
 * far more checkouts than that from one test account, so every scenario begins with them cleared
 * (dev Upstash only, see README).
 */
export async function resetCheckoutLimits() {
  const { Redis } = require("@upstash/redis");
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  let cursor: string | number = 0;
  do {
    const [next, found] = (await redis.scan(cursor, { match: "checkout_start:*", count: 200 })) as [string, string[]];
    if (found.length) await redis.del(...found);
    cursor = next;
  } while (String(cursor) !== "0");
}

/** Click "Pay Securely" and wait for Razorpay's real Checkout window. Returns the create-order response. */
export async function startPayment(page: Page) {
  const created = page.waitForResponse((r) => r.url().endsWith("/api/checkout/create-order"));
  await page.locator("#checkout-pay-button").click();
  const res = await created;
  const body = await res.json().catch(() => ({}));
  if (res.status() === 200) await page.waitForSelector("iframe.razorpay-checkout-frame", { timeout: 60_000 });
  return { status: res.status(), body };
}

/** Enter the card in the real Checkout window and press Enter; handles the "save card" prompt. */
export async function enterCard(page: Page, card = SUCCESS_CARD) {
  const frame = checkoutFrame(page);
  // a returning customer's contact details are prefilled; if Razorpay still asks, give them
  const mobile = frame.getByPlaceholder("Mobile number");
  if (await mobile.isVisible().catch(() => false)) { await mobile.fill("9811122233"); await frame.getByRole("button", { name: "Continue" }).click(); }
  await frame.getByText("Cards", { exact: true }).first().click();
  const number = frame.getByPlaceholder("Card Number");
  await number.pressSequentially(card, { delay: 30 });
  await frame.getByPlaceholder("MM / YY").pressSequentially("1230", { delay: 30 });
  await frame.getByPlaceholder("CVV").pressSequentially("123", { delay: 30 });
}

/** Submit the card and return the bank page Razorpay opens in test mode (it has Success / Failure buttons). */
export async function submitCard(page: Page, ctx: BrowserContext): Promise<Page> {
  const frame = checkoutFrame(page);
  const popup = ctx.waitForEvent("page", { timeout: 60_000 });
  await frame.getByPlaceholder("CVV").press("Enter");
  await frame.getByRole("button", { name: "Maybe later" }).click({ timeout: 8_000 }).catch(() => { /* prompt not shown */ });
  const bank = await popup;
  await bank.waitForLoadState();
  await expect(bank.getByText("This is just a demo bank page.")).toBeVisible();
  return bank;
}

/** The documented mock bank page: pick the outcome of the payment. */
export async function chooseOutcome(bank: Page, outcome: "Success" | "Failure") {
  await bank.getByRole("button", { name: outcome }).click();
}

/**
 * Close the Razorpay window without paying: the X, then "yes" on the "are you sure" question.
 * (After a failed payment Razorpay shows its "save your card" prompt again for the retry. It is
 * left alone: its "Maybe later" button would start a new payment.)
 * Returns as soon as the confirmation is clicked, so a test can look at the page's reaction.
 */
export async function dismissCheckout(page: Page) {
  const frame = checkoutFrame(page);
  // "Yes, secure my card" is the save-card prompt's button, never the one we want
  const confirm = frame.getByRole("button", { name: /^yes/i }).filter({ hasNotText: /secure/i }).locator("visible=true").first();
  // several windows can each have a close button; the last visible one is the top-most
  const close = frame.getByRole("button", { name: /close/i }).locator("visible=true").last();
  const deadline = Date.now() + 40_000;
  // Razorpay's own screens come and go (the save-card prompt can pop up again after a failure),
  // so look at what is on screen each time round instead of assuming an order.
  while (Date.now() < deadline) {
    if (await confirm.isVisible().catch(() => false)) { await confirm.click({ force: true, timeout: 5_000 }); return; }
    // NOT "Maybe later": on the save-card prompt that button means "pay again without saving the card"
    await close.click({ force: true, timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(800);
    // Razorpay's window also closes on Escape; that helps when its X is covered by a prompt
    if (!(await confirm.isVisible().catch(() => false))) await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  const visible = await frame.locator("button, [role=button]").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => `${(e.getAttribute("title") || e.textContent || "").trim().slice(0, 30)}`)).catch(() => []);
  await page.screenshot({ path: "e2e-artifacts/dismiss-stuck.png" });
  throw new Error(`Could not close the Razorpay window: no confirmation question appeared. Visible buttons: ${JSON.stringify(visible)}`);
}
export async function checkoutClosed(page: Page) {
  await page.waitForSelector("iframe.razorpay-checkout-frame", { state: "detached", timeout: 20_000 });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
/**
 * Payload shape from Razorpay's documentation for payment.captured (entity, account_id, event,
 * contains, payload.payment.entity, created_at). Razorpay's docs show no order.paid sample: it is
 * built the same way plus `payload.order.entity`, which is what the app reads.
 */
export function webhookPayload(event: "payment.captured" | "order.paid", o: { orderId: string; paymentId: string; amountPaise: number; email?: string }) {
  const payment = {
    id: o.paymentId, entity: "payment", amount: o.amountPaise, currency: "INR", status: "captured", order_id: o.orderId,
    invoice_id: null, international: false, method: "card", amount_refunded: 0, refund_status: null, captured: true,
    description: "Indian Mist order", card_id: "card_e2e", email: o.email ?? "e2e@example.test", contact: "+919811122233",
    notes: [], fee: 0, tax: 0, error_code: null, error_description: null, created_at: Math.floor(Date.now() / 1000),
  };
  return {
    entity: "event", account_id: "acc_E2ETEST", event, contains: event === "order.paid" ? ["payment", "order"] : ["payment"],
    payload: {
      payment: { entity: payment },
      ...(event === "order.paid" && { order: { entity: { id: o.orderId, entity: "order", amount: o.amountPaise, amount_paid: o.amountPaise, amount_due: 0, currency: "INR", status: "paid" } } }),
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

export const REAL_WEBHOOK = process.env.E2E_REAL_WEBHOOK === "1";

/** POSTs a webhook to the LOCAL app, signed with the webhook secret exactly as Razorpay does. */
export async function sendSignedWebhook(payload: unknown, opts: { secret?: string } = {}) {
  const raw = JSON.stringify(payload);
  const signature = createHmac("sha256", opts.secret ?? process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");
  const res = await fetch(`${BASE_URL}/api/webhooks/razorpay`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature }, body: raw });
  return { status: res.status, body: await res.json().catch(() => null) };
}

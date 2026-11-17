import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState, signPayment, signWebhook } from "./helpers/razorpay";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";
import { adminCall } from "./helpers/admin";

// E-mails to the shop owner: real routes and finalizeOrder, real nodemailer, a local fake SMTP server.
const hoisted = vi.hoisted(() => ({ afterQueue: [] as (() => unknown)[] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => { hoisted.afterQueue.push(task); },
}));

import { Product } from "@/models/product.model";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import Settings from "@/models/settings.model";
import { EmailLog } from "@/models/email-log.model";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";
import { finalizeOrder } from "@/lib/finalize-order";
import { orderNumber } from "@/lib/order-number";
import { resetRedisForTests } from "@/lib/redis";
import { mailTimeouts, resetSmtpTransportForTests, setTransportForTests } from "@/lib/email/transport";
import { sweepFailedEmails, sweepThrottled, resetSweepThrottleForTests } from "@/lib/email/sweep";
import { sendMail } from "@/lib/email";
import { sendOwnerEmail, maybeSendFailedSummary } from "@/lib/email/owner-mail";
import { OWNER_HOURLY_CAP, resetCapLogsForTests } from "@/lib/email/owner-budget";
import { summaryDay } from "@/lib/email/owner-data";
import { formatMoney } from "@/lib/email/money";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as verifyPayment from "@/app/api/checkout/verify-payment/route";
import * as webhook from "@/app/api/webhooks/razorpay/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import * as ordersList from "@/app/api/admin/orders/route";

setupTestDb();

const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
const KEY_SECRET = "unit-secret";
const WEBHOOK_SECRET = "unit-webhook-secret";
const OWNER = "owner@shop.test";
const ACCOUNT = "customer@acct.test";
let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let logs: string[];
let userId: string;
let n = 0;
const original = { ...mailTimeouts };

async function flush() {
  while (hoisted.afterQueue.length) for (const task of hoisted.afterQueue.splice(0)) await task();
}

beforeEach(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "u", SMTP_PASS: "p-secret-smtp", SMTP_FROM: "noreply@shop.test", VERCEL_ENV: "production" });
  delete process.env.EMAIL_ENABLED;
  delete process.env.EMAIL_ALLOWLIST;
  delete process.env.EMAIL_DAILY_LIMIT;
  delete process.env.SUPER_ADMIN_EMAIL;
  Object.assign(mailTimeouts, { connection: 400, greeting: 400, socket: 600, deadline: 1500 });
  resetSmtpTransportForTests();
  setTransportForTests(null);
  resetSweepThrottleForTests();
  resetCapLogsForTests();
  fakeRedis.reset();
  resetRedisForTests();
  razorpayState.reset();
  hoisted.afterQueue.length = 0;
  logs = [];
  const grab = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  vi.spyOn(console, "error").mockImplementation(grab);
  vi.spyOn(console, "warn").mockImplementation(grab);
  vi.spyOn(console, "log").mockImplementation(grab);
  userId = String((await User.create({ name: "Asha Rao", email: ACCOUNT, password: "x", isVerified: true }))._id);
  await Settings.create({ contactPageSettings: { email: OWNER } });
});
afterEach(async () => {
  Object.assign(mailTimeouts, original);
  setTransportForTests(null);
  resetSmtpTransportForTests();
  vi.restoreAllMocks();
  await sink.close();
});

// ─── helpers ────────────────────────────────────────────────────────────────

const newProduct = (stock = 1000) => {
  n++;
  return Product.create({
    name: `Tee ${n}`, slug: `own-${n}`, description: "d", category: "tees", price: 500,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: stock,
  });
};

async function checkout(quantity = 1, productId?: string, customerName = "Test Buyer") {
  const id = productId ?? String((await newProduct())._id);
  fakeRedis.reset();
  const res = await createOrder.POST(new NextRequest("http://localhost/api/checkout/create-order", {
    method: "POST",
    headers: { "x-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify({ items: [{ productId: id, quantity }], customerName, email: "typed@elsewhere.test", phone: "9999999999", shippingAddress: ADDRESS }),
  }), { params: Promise.resolve({}) });
  expect(res.status).toBe(200);
  return (await res.json()).razorpayOrderId as string;
}

const viaBrowser = (razorpayOrderId: string, paymentId: string) =>
  verifyPayment.POST(new NextRequest("http://localhost/api/checkout/verify-payment", {
    method: "POST",
    headers: { "x-user-id": userId, "content-type": "application/json" },
    body: JSON.stringify({ razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signPayment(razorpayOrderId, paymentId, KEY_SECRET) }),
  }), { params: Promise.resolve({}) });

const viaWebhook = (razorpayOrderId: string, paymentId: string, amount = 100000, event = "payment.captured") => {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount } } } });
  return webhook.POST(new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST", headers: { "x-razorpay-signature": signWebhook(body, WEBHOOK_SECRET) }, body,
  }));
};

async function paidOrder(quantity = 1, productId?: string, paymentId = `pay_o${++n}`, customerName?: string) {
  const rzp = await checkout(quantity, productId, customerName);
  expect((await viaBrowser(rzp, paymentId)).status).toBe(200);
  await flush();
  return (await Order.findOne({ razorpayOrderId: rzp }))!;
}

const setStatus = async (id: unknown, json: Record<string, unknown>) => {
  const res = await adminCall(orderStatus.PATCH, { method: "PATCH", json }, { id: String(id) });
  await flush();
  return res;
};

function decode(raw: string) {
  const headers = headersOf(raw);
  const subjectLine = headers.find((h) => /^subject:/i.test(h)) ?? "";
  const subject = subjectLine.slice(8).trim().replace(/=\?UTF-8\?([QB])\?([^?]*)\?=\s*/gi, (_m, enc, body) =>
    enc.toUpperCase() === "B"
      ? Buffer.from(body, "base64").toString("utf8")
      : Buffer.from(body.replace(/_/g, " ").replace(/=([0-9A-F]{2})/g, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"),
  );
  const boundary = /boundary="([^"]+)"/.exec(raw)?.[1] ?? "";
  const parts: Record<string, string> = {};
  for (const chunk of raw.split(`--${boundary}`).slice(1)) {
    const [head, ...rest] = chunk.split("\r\n\r\n");
    const type = /Content-Type: text\/(plain|html)/i.exec(head)?.[1]?.toLowerCase();
    if (!type) continue;
    const enc = /Content-Transfer-Encoding: (\S+)/i.exec(head)?.[1].toLowerCase();
    let content = rest.join("\r\n\r\n");
    if (enc === "base64") content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
    else if (enc === "quoted-printable")
      content = Buffer.from(content.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
    parts[type] = content;
  }
  return { headers, subject, html: parts.html ?? "", text: parts.plain ?? "" };
}
const mails = () => sink.state.messages.map((m) => ({ ...decode(m.raw), rcptTo: m.rcptTo }));
const toOwner = () => mails().filter((m) => m.rcptTo.join().includes(OWNER));
const ownerSubjects = (re: RegExp) => toOwner().filter((m) => re.test(m.subject));
const rows = (type: string) => EmailLog.find({ type }).lean();

// ─── 1. new order ───────────────────────────────────────────────────────────

describe("new order", () => {
  it("goes to the owner address with items, totals, customer name, delivery address, order number and a link to the admin order", async () => {
    const order = await paidOrder(1, undefined, "pay_new1", "Ravi Kumar");
    const [m] = ownerSubjects(/New order/);
    expect(m).toBeDefined();
    expect(m.rcptTo.join()).toContain(OWNER);
    expect(m.subject).toBe(`New order ${orderNumber(order._id)}: ${formatMoney(order.totalAmount)} from Ravi Kumar`);
    for (const body of [m.html, m.text]) {
      expect(body).toContain("Ravi Kumar");
      expect(body).toContain(order.items[0].name);
      expect(body).toContain(formatMoney(order.items[0].priceAtPurchase));
      expect(body).toContain(formatMoney(order.totalAmount));
      expect(body).toContain("1 Test Road");
      expect(body).toContain(orderNumber(order._id));
      expect(body).toContain(`https://shop.example.test/admin/orders?order=${order._id}`);
    }
    expect(m.text).not.toMatch(/<\/?(table|td|tr|p|a|div)\b/i);
    expect(m.html).toContain('width="600"');
    // not a customer e-mail: it is not addressed to the account, and has no Reply-To
    expect(m.rcptTo.join()).not.toContain(ACCOUNT);
    expect(m.headers.some((h) => /^reply-to:/i.test(h))).toBe(false);
  });

  it("falls back to SUPER_ADMIN_EMAIL when no contact address is saved", async () => {
    await Settings.deleteMany({});
    process.env.SUPER_ADMIN_EMAIL = "boss@shop.test";
    await paidOrder(1);
    expect(mails().filter((m) => m.rcptTo.join().includes("boss@shop.test") && /New order/.test(m.subject))).toHaveLength(1);
  });

  it("with no owner address at all nothing is sent to the owner, and the order and the customer's e-mail are unaffected", async () => {
    await Settings.deleteMany({});
    const order = await paidOrder(1);
    expect(order.paymentStatus).toBe("PAID");
    expect(mails().filter((m) => /New order/.test(m.subject))).toHaveLength(0);
    expect(mails().filter((m) => m.rcptTo.join().includes(ACCOUNT))).toHaveLength(1);
    expect(logs.join("\n")).toContain("no owner address");
  });

  it("browser confirmation + two webhooks + two direct calls at once: ONE alert, from the creator", async () => {
    for (let round = 0; round < 6; round++) {
      sink.state.messages.length = 0;
      await EmailLog.deleteMany({});
      const rzp = await checkout(1);
      const pay = `pay_burst${round}${Math.random().toString(36).slice(2, 6)}`;
      await Promise.all([
        viaBrowser(rzp, pay), viaWebhook(rzp, pay), viaWebhook(rzp, pay, 100000, "order.paid"),
        finalizeOrder({ razorpayOrderId: rzp, razorpayPaymentId: pay, userId, source: "verify-payment" }),
        finalizeOrder({ razorpayOrderId: rzp, razorpayPaymentId: pay, source: "webhook" }),
      ]);
      await flush();
      expect(ownerSubjects(/New order/), `round ${round}`).toHaveLength(1);
      expect(await EmailLog.countDocuments({ type: "owner-new-order" })).toBe(1);
    }
  }, 120_000);

  it("HTML in the customer's name and address is escaped in the owner's HTML and literal in the text", async () => {
    const order = await paidOrder(1);
    await Order.updateOne({ _id: order._id }, { $set: { customerName: `<script>alert(1)</script>`, "shippingAddress.street": `"><img src=x onerror=1>` } });
    await EmailLog.deleteMany({});
    sink.state.messages.length = 0;
    expect((await sendOwnerEmail("owner-new-order", String(order._id))).status).toBe("sent");
    const [m] = toOwner();
    expect(m.html).not.toMatch(/<script|<img src=x/);
    expect(m.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(m.text).toContain("<script>alert(1)</script>");
  });
});

// ─── 2. payment problems ────────────────────────────────────────────────────

describe("payment problem alerts (URGENT)", () => {
  it("a payment captured with no order: one URGENT alert with the Razorpay ids and the exact next step, however often Razorpay repeats the webhook", async () => {
    // nothing pending in Redis for this Razorpay order: the shop cannot create an order for it
    const results = await Promise.all(Array.from({ length: 6 }, () => viaWebhook("order_gone123", "pay_gone456", 59900)));
    for (const r of results) expect(r.status).toBe(200);
    await viaWebhook("order_gone123", "pay_gone456", 59900, "order.paid");
    await flush();

    expect(await UnmatchedPayment.countDocuments({})).toBe(1);
    const alerts = ownerSubjects(/URGENT/);
    expect(alerts).toHaveLength(1);
    const [m] = alerts;
    expect(m.subject).toBe("URGENT: Payment received but no order was created");
    for (const body of [m.html, m.text]) {
      expect(body).toContain("pay_gone456");
      expect(body).toContain("order_gone123");
      expect(body).toContain("₹599");
      expect(body).toMatch(/Razorpay Dashboard/);
      expect(body).toMatch(/refund the payment in Razorpay/);
      expect(body).toMatch(/Mark resolved/);
    }
    expect(await EmailLog.countDocuments({ type: "owner-payment-alert" })).toBe(1);
  });

  it("the browser confirmation of a payment with no order alerts too, and a different payment is its own alert", async () => {
    const r = await viaBrowser("order_gone_b", "pay_gone_b");
    expect(r.status).toBe(404);
    await viaWebhook("order_gone_c", "pay_gone_c");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(2);
  });

  it("the same payment recorded on two orders: one URGENT alert saying ship only one", async () => {
    await paidOrder(1, undefined, "pay_same1");
    sink.state.messages.length = 0;
    const second = await paidOrder(1, undefined, "pay_same1");
    expect(second.reviewNote).toContain("The same payment was recorded twice");
    const alerts = ownerSubjects(/URGENT/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe("URGENT: The same payment is recorded on two orders");
    for (const body of [alerts[0].html, alerts[0].text]) {
      expect(body).toContain("pay_same1");
      expect(body).toMatch(/Ship only ONE/);
      expect(body).toContain(second.razorpayOrderId!);
    }
    // a retry of the confirmation does not alert again
    await viaBrowser(second.razorpayOrderId!, "pay_same1");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(1);
  });

  it("a refund to make (a paid order cancelled): one URGENT alert with the payment id, the amount and the steps; cancelling again alerts nothing", async () => {
    const order = await paidOrder(1, undefined, "pay_refund9");
    sink.state.messages.length = 0;
    expect((await setStatus(order._id, { status: "CANCELLED" })).status).toBe(200);
    expect((await setStatus(order._id, { status: "CANCELLED" })).status).toBe(409);
    const alerts = ownerSubjects(/URGENT/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe(`URGENT: Refund to make for cancelled order ${orderNumber(order._id)}`);
    for (const body of [alerts[0].html, alerts[0].text]) {
      expect(body).toContain("pay_refund9");
      expect(body).toContain(order.razorpayOrderId!);
      expect(body).toContain(formatMoney(order.totalAmount));
      expect(body).toMatch(/press Refund/);
      expect(body).toMatch(/Refund status to Refunded/);
    }
  });

  it("an order flagged for review (the amount paid does not match): one URGENT alert with the note, once however many events arrive", async () => {
    const rzp = await checkout(1);
    // the webhook reports 1000 rupees, the order is not
    await Promise.all([viaWebhook(rzp, "pay_mismatch1", 100000), viaWebhook(rzp, "pay_mismatch1", 100000, "order.paid")]);
    await viaWebhook(rzp, "pay_mismatch1", 100000);
    await viaBrowser(rzp, "pay_mismatch1");
    await flush();
    const order = (await Order.findOne({ razorpayOrderId: rzp }))!;
    expect(order.reviewNote).toContain("Amount mismatch");
    const alerts = ownerSubjects(/URGENT/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe(`URGENT: Order ${orderNumber(order._id)} needs review before you ship it`);
    for (const body of [alerts[0].html, alerts[0].text]) {
      expect(body).toContain("Amount mismatch");
      expect(body).toContain("pay_mismatch1");
      expect(body).toContain(rzp);
    }
  });

  it("a LATE webhook that finds the amount does not match (the order already exists) still alerts, once", async () => {
    const rzp = await checkout(1);
    expect((await viaBrowser(rzp, "pay_late_mm")).status).toBe(200); // creates the order; no amount known yet
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(0);
    await viaWebhook(rzp, "pay_late_mm", 100000);
    await viaWebhook(rzp, "pay_late_mm", 100000, "order.paid");
    await flush();
    const alerts = ownerSubjects(/URGENT/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toContain("Amount mismatch");
  });

  it("an order with nothing to review sends no alert", async () => {
    await paidOrder(1, undefined, "pay_clean1");
    expect(ownerSubjects(/URGENT/)).toHaveLength(0);
  });

  it("no card data and no secret is ever in an owner e-mail", async () => {
    await viaWebhook("order_gone_s", "pay_gone_s");
    const order = await paidOrder(1, undefined, "pay_sec1");
    await setStatus(order._id, { status: "CANCELLED" });
    await flush();
    expect(toOwner().length).toBeGreaterThanOrEqual(3);
    for (const m of toOwner()) {
      const all = `${m.subject}\n${m.html}\n${m.text}\n${m.headers.join("\n")}`;
      for (const secret of [KEY_SECRET, WEBHOOK_SECRET, "p-secret-smtp", "JWT", process.env.JWT_ACCESS_SECRET!, process.env.RAZORPAY_KEY_ID!]) {
        expect(all, secret).not.toContain(secret);
      }
      expect(all).not.toMatch(/\b\d{13,19}\b/); // no card-number-like digits
      expect(all).not.toMatch(/cvv|card number|expiry/i);
    }
  });

  it("an alert never blocks the flow: the mail server down and no owner address, the webhook still answers 200, the order exists, the cancel is saved", async () => {
    sink.state.mode = "drop";
    expect((await viaWebhook("order_gone_x", "pay_gone_x")).status).toBe(200);
    const order = await paidOrder(1, undefined, "pay_blk1");
    expect((await setStatus(order._id, { status: "CANCELLED" })).status).toBe(200);
    expect((await Order.findById(order._id))!.status).toBe("CANCELLED");
    await Settings.deleteMany({});
    const o2 = await paidOrder(1, undefined, "pay_blk2");
    expect((await setStatus(o2._id, { status: "CANCELLED" })).status).toBe(200);
  });
});

// ─── 3. the mail server is down ─────────────────────────────────────────────

describe("the mail server is down", () => {
  it("new-order and payment alerts are kept and retried later; each arrives once", async () => {
    sink.state.mode = "drop";
    const order = await paidOrder(1, undefined, "pay_dn1");
    await viaWebhook("order_gone_dn", "pay_gone_dn");
    await flush();
    expect(sink.state.messages).toHaveLength(0);
    const newOrder = (await rows("owner-new-order"))[0];
    const payment = (await rows("owner-payment-alert"))[0];
    expect(newOrder).toMatchObject({ status: "failed", permanent: false, relatedId: String(order._id) });
    expect(payment).toMatchObject({ status: "failed", permanent: false });

    sink.state.mode = "ok";
    expect(await sweepFailedEmails(Date.now() + 61_000)).toBeGreaterThanOrEqual(3); // + the customer's confirmation
    expect(ownerSubjects(/New order/)).toHaveLength(1);
    expect(ownerSubjects(/URGENT/)).toHaveLength(1);
    expect(await sweepFailedEmails(Date.now() + 10 * 60_000)).toBe(0);
    expect(toOwner()).toHaveLength(2);
  });

  it("a retry goes to the owner address saved NOW, not the one from when it failed", async () => {
    sink.state.mode = "drop";
    await viaWebhook("order_gone_ch", "pay_gone_ch");
    await flush();
    await Settings.updateOne({}, { $set: { "contactPageSettings.email": "boss2@shop.test" } });
    sink.state.mode = "ok";
    await sweepFailedEmails(Date.now() + 61_000);
    expect(mails().filter((m) => m.rcptTo.join().includes("boss2@shop.test") && /URGENT/.test(m.subject))).toHaveLength(1);
    expect(toOwner()).toHaveLength(0);
  });
});

// ─── 4. failed e-mails: one warning a day ───────────────────────────────────

describe("failed-e-mail warning", () => {
  const failedRow = (type: string, id: string, over: Record<string, unknown> = {}) =>
    EmailLog.create({ type, dedupeKey: `${type}:${id}`, relatedId: id, status: "failed", permanent: true, attempts: 1, lastErrorCode: "550", ...over });

  it("one warning when something has failed for good, listing the kinds and counts, and nothing more the same day", async () => {
    await failedRow("order-shipped", "a1");
    await failedRow("order-shipped", "a2");
    await failedRow("order-confirmation", "a3");
    await sweepThrottled();
    await flush();
    const [m] = ownerSubjects(/Warning/);
    expect(m.subject).toBe("Warning: 3 e-mails could not be delivered");
    for (const body of [m.html, m.text]) {
      expect(body).toContain("Shipped: 2");
      expect(body).toContain("Order confirmation: 1");
      expect(body).toMatch(/Resend/);
      expect(body).toMatch(/300 a day/);
    }
    expect(m.text).not.toMatch(/@/); // no customer address in it ... except none
    // another failure the same day, and another sweep: no second warning
    await failedRow("order-cancelled", "a4");
    resetSweepThrottleForTests();
    await sweepThrottled();
    await maybeSendFailedSummary();
    expect(ownerSubjects(/Warning/)).toHaveLength(1);
    // the next day it is reported (once)
    await maybeSendFailedSummary(Date.now() + 25 * 3600_000);
    const warnings = ownerSubjects(/Warning/);
    expect(warnings).toHaveLength(2);
    expect(warnings[1].subject).toBe("Warning: 1 e-mail could not be delivered");
    // and not reported again
    await maybeSendFailedSummary(Date.now() + 50 * 3600_000);
    expect(ownerSubjects(/Warning/)).toHaveLength(2);
  });

  it("nothing is sent when nothing failed for good; sign-in codes and retryable failures do not count", async () => {
    await failedRow("otp-signup", "x1");
    await failedRow("order-shipped", "x2", { permanent: false, nextAttemptAt: new Date(Date.now() + 60_000) });
    await maybeSendFailedSummary();
    expect(sink.state.messages).toHaveLength(0);
  });

  it("when the warning cannot be sent (no owner address) the failures are kept for the next day, not lost", async () => {
    await Settings.deleteMany({});
    await failedRow("order-shipped", "y1");
    await maybeSendFailedSummary();
    expect(sink.state.messages).toHaveLength(0);
    expect((await EmailLog.findOne({ relatedId: "y1" }).lean())!.summaryDate).toBeUndefined();
    await Settings.create({ contactPageSettings: { email: OWNER } });
    await maybeSendFailedSummary(Date.now() + 25 * 3600_000);
    expect(ownerSubjects(/Warning/)).toHaveLength(1);
  });

  it("the warning itself failing is retried by the sweep (no second warning the same day), and its failure is not reported in a warning", async () => {
    await failedRow("order-shipped", "z1");
    sink.state.mode = "drop";
    await maybeSendFailedSummary();
    sink.state.mode = "ok";
    await sweepFailedEmails(Date.now() + 61_000);
    expect(ownerSubjects(/Warning/)).toHaveLength(1);
    await maybeSendFailedSummary();
    expect(ownerSubjects(/Warning/)).toHaveLength(1);
    expect(summaryDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── 5. contact form ────────────────────────────────────────────────────────

describe("contact form", () => {
  it("keeps its message: From is the shop address, Reply-To is the sender, it goes to the owner", async () => {
    const result = await sendMail("contact", OWNER, { name: "Asha", email: "asha@cust.test", topic: "Order support", message: "Where is my parcel? It has been a week." });
    expect(result.status).toBe("sent");
    const [m] = mails();
    expect(m.rcptTo.join()).toContain(OWNER);
    expect(m.headers.find((h) => /^from:/i.test(h))).toContain("noreply@shop.test");
    expect(m.headers.find((h) => /^from:/i.test(h))).not.toContain("asha@cust.test");
    expect(m.headers.find((h) => /^reply-to:/i.test(h))).toContain("asha@cust.test");
    expect(m.subject).toBe("[Contact] Order support — Asha");
    expect(m.html).toContain("New enquiry: Order support");
  });
});

// ─── 6. low stock (optional) ────────────────────────────────────────────────

describe("low stock", () => {
  const stockOf = async (id: unknown) => (await Product.findById(id))!.stockQuantity;

  it("is OFF by default: nothing is sent when a product falls below any level", async () => {
    const p = await newProduct(4);
    await paidOrder(4, String(p._id));
    expect(await stockOf(p._id)).toBe(0);
    expect(ownerSubjects(/stock|Sold out/i)).toHaveLength(0);
  });

  it("is OFF when no settings have ever been saved either (the owner address then comes from SUPER_ADMIN_EMAIL)", async () => {
    await Settings.deleteMany({});
    process.env.SUPER_ADMIN_EMAIL = "boss@shop.test";
    const p = await newProduct(2);
    await paidOrder(2, String(p._id));
    expect(mails().filter((m) => /Low stock|Sold out/.test(m.subject))).toHaveLength(0);
    expect(mails().filter((m) => /New order/.test(m.subject))).toHaveLength(1); // the owner is reachable
  });

  it("when switched on: one e-mail when a product falls to the level, none while it stays down, one more only after a new drop", async () => {
    await Settings.updateOne({}, { $set: { emailSettings: { ownerLowStockAlert: true, lowStockThreshold: 3 } } });
    const p = await newProduct(10);
    const id = String(p._id);

    await paidOrder(2, id);            // 8 left: above the level
    expect(ownerSubjects(/Low stock|Sold out/)).toHaveLength(0);
    const a = await paidOrder(5, id);  // 3 left: at the level
    const alerts = () => ownerSubjects(/Low stock|Sold out/);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].subject).toBe(`Low stock: ${p.name} (3 left)`);
    expect(alerts()[0].text).toContain("level is 3");
    const b = await paidOrder(1, id);  // 2 left: still down, same drop
    expect(alerts()).toHaveLength(1);

    // units come back above the level (both orders cancelled): the next drop alerts again
    await setStatus(a._id, { status: "CANCELLED" });
    await setStatus(b._id, { status: "CANCELLED" });
    expect(await stockOf(id)).toBe(8);
    expect((await Product.findById(id))!.lowStockAlertedAt).toBeUndefined();
    await paidOrder(6, id);            // 2 left
    expect(alerts()).toHaveLength(2);
    // sold out says so
    await paidOrder(2, id);
    expect(alerts()).toHaveLength(2); // still the same drop
    expect(await EmailLog.countDocuments({ type: "owner-low-stock" })).toBe(2);
  });

  it("products without stock tracking never alert; concurrent orders alert once", async () => {
    await Settings.updateOne({}, { $set: { emailSettings: { ownerLowStockAlert: true, lowStockThreshold: 50 } } });
    const untracked = await Product.create({ name: "Untracked", slug: "untracked-1", description: "d", category: "tees", price: 100, images: [{ url: "https://x/a.jpg", publicId: "a", alt: "", isPrimary: true }], trackInventory: false, stockQuantity: 1 });
    await paidOrder(1, String(untracked._id));
    expect(ownerSubjects(/Low stock|Sold out/)).toHaveLength(0);

    const p = await newProduct(60);
    const { claimLowStock } = await import("@/lib/low-stock");
    await Product.updateOne({ _id: p._id }, { $set: { stockQuantity: 40 } });
    const claims = await Promise.all(Array.from({ length: 10 }, () => claimLowStock([p._id])));
    expect(claims.flat()).toHaveLength(1);
  });

  it("the level and switch are saved through the settings route and validated", async () => {
    const settingsRoute = await import("@/app/api/admin/settings/route");
    const ok = await adminCall(settingsRoute.PUT, { method: "PUT", json: { emailSettings: { ownerLowStockAlert: true, lowStockThreshold: 7 } } });
    expect(ok.status).toBe(200);
    expect((await Settings.findOne().lean())!.emailSettings).toMatchObject({ ownerLowStockAlert: true, lowStockThreshold: 7 });
    for (const bad of [{ lowStockThreshold: -1 }, { lowStockThreshold: 1.5 }, { lowStockThreshold: 100000 }, { ownerLowStockAlert: "yes" }]) {
      expect((await adminCall(settingsRoute.PUT, { method: "PUT", json: { emailSettings: bad } })).status).toBe(400);
    }
  });
});

// ─── 7. bursts and the daily allowance ──────────────────────────────────────

describe("volume: hourly caps and the daily allowance", () => {
  const manyOrders = async (count: number) => {
    const ids: string[] = [];
    const p = await newProduct();
    for (let i = 0; i < count; i++) {
      const o = await Order.create({
        userId, items: [{ productId: p._id, name: p.name, quantity: 1, priceAtPurchase: 500 }], status: "PROCESSING", paymentStatus: "PAID",
        totalAmount: 599, subtotal: 500, shippingCost: 99, customerName: "Burst Buyer", email: "b@x.test", phone: "9999999999",
        shippingAddress: { ...ADDRESS, country: "India" }, razorpayOrderId: `order_burst${n}_${i}`, razorpayPaymentId: `pay_burst${n}_${i}`, stockSettled: true,
      });
      ids.push(String(o._id));
    }
    return ids;
  };
  const fillDay = (count: number) =>
    EmailLog.insertMany(Array.from({ length: count }, (_, i) => ({ type: "order-confirmation", dedupeKey: `order-confirmation:fill${i}`, relatedId: `fill${i}`, status: "sent", attempts: 1 })));

  it(`a burst of new orders sends at most ${OWNER_HOURLY_CAP["owner-new-order"]} alerts an hour and logs once that it capped`, async () => {
    const ids = await manyOrders(OWNER_HOURLY_CAP["owner-new-order"] + 5);
    const results = [];
    for (const id of ids) results.push(await sendOwnerEmail("owner-new-order", id));
    expect(results.filter((r) => r.status === "sent")).toHaveLength(OWNER_HOURLY_CAP["owner-new-order"]);
    expect(results.filter((r) => r.status === "capped")).toHaveLength(5);
    expect(ownerSubjects(/New order/)).toHaveLength(OWNER_HOURLY_CAP["owner-new-order"]);
    const lines = logs.filter((l) => l.includes("owner alert capped type=owner-new-order reason=hourly"));
    expect(lines).toHaveLength(1); // one line per hour, not one per capped alert
    // a repeat of one that was already sent is a duplicate, not a cap
    expect((await sendOwnerEmail("owner-new-order", ids[0])).status).toBe("duplicate");
  });

  it("payment alerts have their own, larger cap and are not used up by new-order alerts", async () => {
    const ids = await manyOrders(OWNER_HOURLY_CAP["owner-new-order"] + 2);
    for (const id of ids) await sendOwnerEmail("owner-new-order", id);
    for (let i = 0; i < 12; i++) await viaWebhook(`order_gone_cap${i}`, `pay_gone_cap${i}`);
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(12);
  });

  it("when the day's allowance is nearly used, new-order alerts stop first and payment alerts keep going", async () => {
    process.env.EMAIL_DAILY_LIMIT = "100";
    await fillDay(72); // 72% of 100: past the 70% line for new orders, under the 95% line for payment problems
    const [orderId] = await manyOrders(1);
    const blocked = await sendOwnerEmail("owner-new-order", orderId);
    expect(blocked).toEqual({ status: "capped", reason: "daily-near-limit" });
    expect(logs.join("\n")).toContain("owner alert capped type=owner-new-order reason=daily-near-limit");
    await viaWebhook("order_gone_pri", "pay_gone_pri");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(1);
    expect(ownerSubjects(/New order/)).toHaveLength(0);

    await fillDay(0);
    await EmailLog.insertMany(Array.from({ length: 24 }, (_, i) => ({ type: "order-shipped", dedupeKey: `order-shipped:fill2${i}`, relatedId: `fill2${i}`, status: "sent", attempts: 1 }))); // now 97
    await viaWebhook("order_gone_pri2", "pay_gone_pri2");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(1); // past 95%: even payment alerts wait
    expect(logs.join("\n")).toContain("owner alert capped type=owner-payment-alert reason=daily-near-limit");
  });

  it("a capped payment alert is not lost for good: its webhook retry alerts once the cap has passed", async () => {
    process.env.EMAIL_DAILY_LIMIT = "100";
    await fillDay(96);
    await viaWebhook("order_gone_retry", "pay_gone_retry");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(0);
    await EmailLog.deleteMany({ dedupeKey: /fill/ });
    await viaWebhook("order_gone_retry", "pay_gone_retry"); // Razorpay retries
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(1);
  });

  it("customers' e-mails are not capped by the owner caps", async () => {
    process.env.EMAIL_DAILY_LIMIT = "100";
    await fillDay(80);
    const order = await paidOrder(1);
    expect(mails().filter((m) => m.rcptTo.join().includes(ACCOUNT))).toHaveLength(1);
    expect(order).toBeTruthy();
  });
});

// ─── 8. non-production guard ────────────────────────────────────────────────

describe("outside production", () => {
  it("owner alerts only reach an allowlisted address; otherwise nothing is even sent to the server", async () => {
    delete process.env.VERCEL_ENV;
    process.env.EMAIL_ALLOWLIST = "someone-else@dev.test";
    await paidOrder(1);
    await viaWebhook("order_gone_g", "pay_gone_g");
    await flush();
    expect(sink.state.connections).toBe(0);
    expect(await EmailLog.countDocuments({})).toBe(0);
    expect(logs.join("\n")).toContain("dropped type=owner-new-order");
    expect(logs.join("\n")).toContain("dropped type=owner-payment-alert");

    process.env.EMAIL_ALLOWLIST = "@shop.test";
    await viaWebhook("order_gone_g2", "pay_gone_g2");
    await flush();
    expect(ownerSubjects(/URGENT/)).toHaveLength(1);
  });

  it("EMAIL_ENABLED=false stops owner alerts too", async () => {
    process.env.EMAIL_ENABLED = "false";
    await viaWebhook("order_gone_k", "pay_gone_k");
    await paidOrder(1);
    expect(sink.state.connections).toBe(0);
  });
});

// ─── 9. the admin order link ────────────────────────────────────────────────

describe("the link in the owner's e-mail", () => {
  it("?order=<id> returns that one order whatever its status or page, and nothing else", async () => {
    const a = await paidOrder(1);
    await paidOrder(1);
    await setStatus(a._id, { status: "CANCELLED" });
    const one = await (await adminCall(ordersList.GET, { method: "GET" }, {})).json();
    expect(one.orders.length).toBe(2);
    const res = await ordersList.GET(new NextRequest(`http://localhost/api/admin/orders?status=PROCESSING&order=${a._id}`, { headers: { "x-user-role": "admin", "x-user-id": "u1", "x-user-email": "a@b.c" } }), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(String(body.orders[0]._id)).toBe(String(a._id));
    // a junk value is ignored (the normal list)
    const junk = await ordersList.GET(new NextRequest("http://localhost/api/admin/orders?order=not-an-id", { headers: { "x-user-role": "admin", "x-user-id": "u1", "x-user-email": "a@b.c" } }), { params: Promise.resolve({}) });
    expect((await junk.json()).orders).toHaveLength(2);
    void mongoose;
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState, signPayment, signWebhook } from "./helpers/razorpay";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";
import { adminCall } from "./helpers/admin";

// Customer order e-mails end to end: the real routes and finalizeOrder, real nodemailer, a local fake SMTP server.
const hoisted = vi.hoisted(() => ({ afterQueue: [] as (() => unknown)[] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
vi.mock("razorpay", async () => (await import("./helpers/razorpay")).razorpayModuleMock());
// `after()` runs the task once the response is done: here, when the test calls flush()
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => { hoisted.afterQueue.push(task); },
}));
// Counts who asks for a confirmation (the loser of the race must not)
vi.mock("@/lib/email/order-mail", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/email/order-mail")>();
  return { ...real, queueOrderEmail: vi.fn(real.queueOrderEmail) };
});

import { Product } from "@/models/product.model";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import Settings from "@/models/settings.model";
import { EmailLog } from "@/models/email-log.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { finalizeOrder } from "@/lib/finalize-order";
import { orderNumber } from "@/lib/order-number";
import { setOtp } from "@/lib/otp-store";
import { resetRedisForTests } from "@/lib/redis";
import { queueOrderEmail } from "@/lib/email/order-mail";
import { mailTimeouts, resetSmtpTransportForTests, setTransportForTests } from "@/lib/email/transport";
import { sweepFailedEmails, resetSweepThrottleForTests } from "@/lib/email/sweep";
import { cancellationRefundWording } from "@/lib/email/order-templates";
import { formatMoney } from "@/lib/email/money";
import { parseTracking } from "@/lib/order-tracking";
import * as createOrder from "@/app/api/checkout/create-order/route";
import * as verifyPayment from "@/app/api/checkout/verify-payment/route";
import * as webhook from "@/app/api/webhooks/razorpay/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import * as orderRefund from "@/app/api/admin/orders/[id]/refund/route";
import * as ordersList from "@/app/api/admin/orders/route";
import * as resendRoute from "@/app/api/admin/emails/[id]/resend/route";
import * as profile from "@/app/api/profile/route";
import * as reset from "@/app/api/auth/forgot-password/reset/route";

setupTestDb();

const ADDRESS = { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" };
const KEY_SECRET = "unit-secret";
const WEBHOOK_SECRET = "unit-webhook-secret";
const ACCOUNT = "account-owner@acct.test"; // the account's address ...
const TYPED = "typed-at-checkout@elsewhere.test"; // ... is not the address typed into the checkout form
let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let logs: string[];
let userId: string;
let n = 0;
const original = { ...mailTimeouts };

/** Runs everything `after()` was given, until nothing is left (a task may add more). */
async function flush() {
  while (hoisted.afterQueue.length) for (const task of hoisted.afterQueue.splice(0)) await task();
}

beforeEach(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "u", SMTP_PASS: "p", SMTP_FROM: "noreply@shop.test", VERCEL_ENV: "production" });
  delete process.env.EMAIL_ENABLED;
  delete process.env.EMAIL_ALLOWLIST;
  Object.assign(mailTimeouts, { connection: 400, greeting: 400, socket: 600, deadline: 1500 });
  resetSmtpTransportForTests();
  setTransportForTests(null);
  resetSweepThrottleForTests();
  fakeRedis.reset();
  resetRedisForTests();
  razorpayState.reset();
  hoisted.afterQueue.length = 0;
  vi.mocked(queueOrderEmail).mockClear();
  logs = [];
  const grab = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  vi.spyOn(console, "error").mockImplementation(grab);
  vi.spyOn(console, "warn").mockImplementation(grab);
  vi.spyOn(console, "log").mockImplementation(grab);
  userId = String((await User.create({ name: "Asha Rao", email: ACCOUNT, password: "x", isVerified: true }))._id);
});
afterEach(async () => {
  Object.assign(mailTimeouts, original);
  setTransportForTests(null);
  resetSmtpTransportForTests();
  vi.restoreAllMocks();
  await sink.close();
});

// ─── helpers ────────────────────────────────────────────────────────────────

const newProduct = () => {
  n++;
  return Product.create({
    name: `Tee ${n}`, slug: `oe-${n}`, description: "d", category: "tees", price: 500,
    images: [{ url: "https://x/a.jpg", publicId: "indian-mist/products/a", alt: "", isPrimary: true }],
    trackInventory: true, stockQuantity: 1000,
  });
};

async function checkout(quantity = 1, asUser = userId) {
  const p = await newProduct();
  fakeRedis.reset();
  const res = await createOrder.POST(new NextRequest("http://localhost/api/checkout/create-order", {
    method: "POST",
    headers: { "x-user-id": asUser, "content-type": "application/json" },
    body: JSON.stringify({ items: [{ productId: String(p._id), quantity }], customerName: "Test Buyer", email: TYPED, phone: "9999999999", shippingAddress: ADDRESS }),
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

const viaWebhook = (razorpayOrderId: string, paymentId: string, event = "payment.captured") => {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount: 100000 } } } });
  return webhook.POST(new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST", headers: { "x-razorpay-signature": signWebhook(body, WEBHOOK_SECRET) }, body,
  }));
};

/** A real paid order (create-order, then the browser confirmation); the confirmation e-mail is sent too. */
async function paidOrder(quantity = 1) {
  const rzp = await checkout(quantity);
  expect((await viaBrowser(rzp, `pay_${++n}`)).status).toBe(200);
  await flush();
  const order = (await Order.findOne({ razorpayOrderId: rzp }))!;
  return order;
}

const setStatus = async (id: unknown, json: Record<string, unknown>) => {
  const res = await adminCall(orderStatus.PATCH, { method: "PATCH", json }, { id: String(id) });
  await flush();
  return res;
};
const setRefund = async (id: unknown, json: Record<string, unknown>) => {
  const res = await adminCall(orderRefund.PATCH, { method: "PATCH", json }, { id: String(id) });
  await flush();
  return res;
};

/** The decoded subject, headers and text/html parts of a message the fake server recorded. */
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
const mailsOf = (subject: RegExp) => mails().filter((m) => subject.test(m.subject));
const logRows = (type: string) => EmailLog.find({ type }).lean();

// ─── 1. confirmation ────────────────────────────────────────────────────────

describe("order confirmation", () => {
  it("goes to the ACCOUNT's address (not the one typed at checkout) with items, shipping, total, address, number and a My Orders link", async () => {
    await Settings.create({ contactPageSettings: { email: "help@shop.test", phone: "+91 98765 43210", businessHours: "Mon-Sat 10-6" } });
    const order = await paidOrder(1);

    expect(sink.state.messages).toHaveLength(1);
    const [m] = mails();
    expect(m.rcptTo.join()).toContain(ACCOUNT);
    expect(m.rcptTo.join()).not.toContain(TYPED);
    expect(m.subject).toBe(`Order confirmed: ${orderNumber(order._id)}`);
    expect(m.headers.find((h) => /^reply-to:/i.test(h))).toContain("help@shop.test");

    for (const body of [m.html, m.text]) {
      expect(body).toContain(orderNumber(order._id));
      expect(body).toContain(order.items[0].name);
      expect(body).toContain(formatMoney(order.items[0].priceAtPurchase));
      expect(body).toContain(formatMoney(order.totalAmount));
      expect(body).toContain("1 Test Road");
      expect(body).toContain("Pune");
      expect(body).toContain("https://shop.example.test/profile"); // My Orders
      expect(body).toContain("help@shop.test"); // how to reach the shop
      expect(body).toContain("98765 43210");
    }
    // shipping is shown (a paid shipping cost or "Free") and the order has a subtotal line
    expect(m.text).toMatch(/Shipping: (Free|₹\d)/);
    expect(m.text).toMatch(/Subtotal: ₹/);
  });

  it("promises no invoice and no delivery date; it is a 600 px table layout with a plain-text twin", async () => {
    await paidOrder(1);
    const [m] = mails();
    for (const body of [m.html, m.text]) {
      expect(body).not.toMatch(/invoice|estimated delivery|delivery date|arrive by|delivered by/i);
    }
    expect(m.html).toContain('width="600"');
    expect(m.html).toContain("max-width:600px");
    expect(m.html).toContain("<table");
    expect(m.text).not.toMatch(/<\/?(table|td|tr|p|a|div|span|br)\b/i); // really plain text
    expect(m.text.length).toBeGreaterThan(100);
  });

  it("shows the discount and tax lines only when there is one", async () => {
    const order = await paidOrder(1);
    expect(mails()[0].text).not.toMatch(/Discount|Taxes/);
    await Order.updateOne({ _id: order._id }, { $set: { discountAmount: 50, promoCode: "SAVE50", taxAmount: 18 } });
    await setStatus(order._id, { status: "SHIPPED" });
    const shipped = mailsOf(/shipped/)[0];
    expect(shipped.text).toContain("Discount (SAVE50): -₹50");
    expect(shipped.text).toContain("Taxes: ₹18");
  });
});

// ─── 2. exactly once, whichever path wins ───────────────────────────────────

describe("the confirmation is sent exactly once", () => {
  it("browser confirmation and two webhooks and two direct calls at the same moment: one e-mail, asked for by the creator only", async () => {
    for (let round = 0; round < 12; round++) {
      sink.state.messages.length = 0;
      vi.mocked(queueOrderEmail).mockClear();
      await EmailLog.deleteMany({});
      const rzp = await checkout(1);
      const paymentId = `pay_c${round}_${Math.random().toString(36).slice(2, 8)}`;
      const results = await Promise.all([
        viaBrowser(rzp, paymentId),
        viaWebhook(rzp, paymentId),
        viaWebhook(rzp, paymentId, "order.paid"),
        finalizeOrder({ razorpayOrderId: rzp, razorpayPaymentId: paymentId, userId, source: "verify-payment" }),
        finalizeOrder({ razorpayOrderId: rzp, razorpayPaymentId: paymentId, source: "webhook" }),
      ]);
      for (const r of results.slice(0, 3)) expect((r as Response).status, `round ${round}`).toBe(200);
      await flush();

      expect(await Order.countDocuments({ razorpayOrderId: rzp }), `round ${round}`).toBe(1);
      // only the path that really created the order asked for an e-mail
      expect(vi.mocked(queueOrderEmail).mock.calls.filter((c) => c[0] === "order-confirmation"), `round ${round}: callers`).toHaveLength(1);
      expect(sink.state.messages, `round ${round}: messages`).toHaveLength(1);
      expect(await EmailLog.countDocuments({ type: "order-confirmation" })).toBe(1);
    }
  }, 120_000);

  it("a confirmation or webhook that arrives LATER (the order already exists) does not ask for an e-mail at all", async () => {
    const rzp = await checkout(1);
    expect((await viaBrowser(rzp, "pay_late")).status).toBe(200);
    await flush();
    vi.mocked(queueOrderEmail).mockClear();
    expect((await viaWebhook(rzp, "pay_late")).status).toBe(200);
    expect((await viaWebhook(rzp, "pay_late", "order.paid")).status).toBe(200);
    expect((await viaBrowser(rzp, "pay_late")).status).toBe(200);
    await finalizeOrder({ razorpayOrderId: rzp, razorpayPaymentId: "pay_late", source: "webhook" });
    await flush();
    expect(vi.mocked(queueOrderEmail)).not.toHaveBeenCalled();
    expect(sink.state.messages).toHaveLength(1);
  });

  it("even when the loser asks too (a repeated confirmation, a webhook retry), the once-only key stops a second e-mail", async () => {
    const order = await paidOrder(1);
    const { sendOrderEmail } = await import("@/lib/email/order-mail");
    const again = await Promise.all(Array.from({ length: 10 }, () => sendOrderEmail("order-confirmation", order._id)));
    expect(again.every((r) => r.status === "duplicate")).toBe(true);
    expect(sink.state.messages).toHaveLength(1);
  });
});

// ─── 3. the mail server is down ─────────────────────────────────────────────

describe("the mail server is down while an order is created", () => {
  it("the order is still created; the e-mail is kept and retried later, then arrives once", async () => {
    sink.state.mode = "drop";
    const rzp = await checkout(1);
    const res = await viaBrowser(rzp, "pay_down");
    expect(res.status).toBe(200);
    await flush();

    const order = (await Order.findOne({ razorpayOrderId: rzp }))!;
    expect(order).toMatchObject({ paymentStatus: "PAID", status: "PROCESSING" });
    expect(sink.state.messages).toHaveLength(0);
    const [row] = await logRows("order-confirmation");
    expect(row).toMatchObject({ status: "failed", permanent: false, relatedId: String(order._id) });
    expect(row.nextAttemptAt).toBeInstanceOf(Date);
    expect(row.recipient).toBe(ACCOUNT);

    // the server comes back; the sweep, once the retry time has come, sends it
    sink.state.mode = "ok";
    expect(await sweepFailedEmails(Date.now() + 61_000)).toBe(1);
    expect(sink.state.messages).toHaveLength(1);
    expect(mails()[0].rcptTo.join()).toContain(ACCOUNT);
    expect((await logRows("order-confirmation"))[0]).toMatchObject({ status: "sent" });

    // nothing more is sent by later sweeps or repeated confirmations
    expect(await sweepFailedEmails(Date.now() + 10 * 60_000)).toBe(0);
    expect(sink.state.messages).toHaveLength(1);
  });

  it("a status change is saved even when its e-mail cannot be sent", async () => {
    const order = await paidOrder(1);
    sink.state.mode = "drop";
    const res = await setStatus(order._id, { status: "SHIPPED" });
    expect(res.status).toBe(200);
    expect((await Order.findById(order._id))!.status).toBe("SHIPPED");
    expect((await logRows("order-shipped"))[0]).toMatchObject({ status: "failed", permanent: false });
  });
});

// ─── 4. shipped ─────────────────────────────────────────────────────────────

describe("shipped", () => {
  it("is sent when the admin sets Shipped, with courier, tracking number and link when they were given", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    const res = await setStatus(order._id, { status: "SHIPPED", courier: "Delhivery", trackingNumber: "DL123456789", trackingUrl: "https://track.example.test/DL123456789" });
    expect(res.status).toBe(200);
    expect(sink.state.messages).toHaveLength(1);
    const [m] = mails();
    expect(m.subject).toBe(`Your order ${orderNumber(order._id)} has shipped`);
    expect(m.rcptTo.join()).toContain(ACCOUNT);
    for (const body of [m.html, m.text]) {
      expect(body).toContain("Delhivery");
      expect(body).toContain("DL123456789");
      expect(body).toContain("https://track.example.test/DL123456789");
    }
    expect(m.html).toContain('href="https://track.example.test/DL123456789"');
    expect(m.text).not.toMatch(/invoice|delivery date|estimated/i);

    // saved on the order, and shown to the customer in My Orders (the profile route)
    const stored = (await Order.findById(order._id))!;
    expect(stored).toMatchObject({ courier: "Delhivery", trackingNumber: "DL123456789", trackingUrl: "https://track.example.test/DL123456789" });
    const mine = await profile.GET(new NextRequest("http://localhost/api/profile", { headers: { "x-user-id": userId } }), { params: Promise.resolve({}) });
    const body = await mine.json();
    expect(body.orders[0]).toMatchObject({ courier: "Delhivery", trackingNumber: "DL123456789", trackingUrl: "https://track.example.test/DL123456789" });
  });

  it("works without any tracking details, and the e-mail then has no tracking section", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    expect((await setStatus(order._id, { status: "SHIPPED" })).status).toBe(200);
    const [m] = mails();
    expect(m.html).not.toMatch(/Tracking number|Courier/);
    expect(m.text).not.toMatch(/Tracking|Courier/);
  });

  it("an invalid tracking link never blocks the status change, is not saved and never becomes a link", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    const res = await setStatus(order._id, { status: "SHIPPED", courier: "Blue Dart", trackingNumber: "B1", trackingUrl: "javascript:alert(1)" });
    expect(res.status).toBe(200);
    expect((await res.json()).ignoredTracking).toEqual(["trackingUrl"]);
    const stored = (await Order.findById(order._id))!;
    expect(stored.status).toBe("SHIPPED");
    expect(stored.trackingUrl).toBeUndefined();
    expect(stored.courier).toBe("Blue Dart");
    const [m] = mails();
    expect(m.html + m.text).not.toContain("javascript:");
  });

  it("a bad tracking link already stored (written some other way) still never becomes a link in the e-mail", async () => {
    const order = await paidOrder(1);
    await Order.updateOne({ _id: order._id }, { $set: { courier: "X", trackingUrl: 'javascript:alert(1)' } });
    sink.state.messages.length = 0;
    await setStatus(order._id, { status: "SHIPPED" });
    const [m] = mails();
    expect(m.html + m.text).not.toContain("javascript:");
    expect(m.html).not.toMatch(/href="javascript/i);
  });

  it("tracking details are optional extras: saving them with the same status adds them and sends no second e-mail; empty text clears them", async () => {
    const order = await paidOrder(1);
    await setStatus(order._id, { status: "SHIPPED" });
    expect(sink.state.messages.filter((m) => /shipped/.test(decode(m.raw).subject))).toHaveLength(1);
    await setStatus(order._id, { status: "SHIPPED", courier: "DTDC", trackingNumber: "T1" });
    expect(await Order.findById(order._id)).toMatchObject({ courier: "DTDC", trackingNumber: "T1" });
    await setStatus(order._id, { status: "SHIPPED", courier: "" });
    expect((await Order.findById(order._id))!.courier).toBeUndefined();
    expect((await Order.findById(order._id))!.trackingNumber).toBe("T1"); // not mentioned: left alone
    expect(mailsOf(/has shipped/)).toHaveLength(1);
  });

  it("saving the same status again sends nothing; the status sequence cannot send Shipped twice", async () => {
    const order = await paidOrder(1);
    await setStatus(order._id, { status: "SHIPPED" });
    await setStatus(order._id, { status: "SHIPPED" });
    await setStatus(order._id, { status: "PROCESSING" });
    await setStatus(order._id, { status: "SHIPPED" });
    await setStatus(order._id, { status: "DELIVERED" });
    await setStatus(order._id, { status: "SHIPPED" });
    expect(mailsOf(/has shipped/)).toHaveLength(1);
    expect(await EmailLog.countDocuments({ type: "order-shipped" })).toBe(1);
  });

  it("moving an order to Processing (or any other status) sends nothing", async () => {
    const order = await paidOrder(1);
    await Order.updateOne({ _id: order._id }, { $set: { status: "SHIPPED" } }); // shipped some other way: no e-mail was sent
    sink.state.messages.length = 0;
    await EmailLog.deleteMany({});
    expect((await setStatus(order._id, { status: "PROCESSING" })).status).toBe(200);
    expect(sink.state.messages).toHaveLength(0);
    expect(await EmailLog.countDocuments({})).toBe(0);
  });

  it("ten admins clicking Shipped at the same moment send one e-mail", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    await Promise.all(Array.from({ length: 10 }, () => adminCall(orderStatus.PATCH, { method: "PATCH", json: { status: "SHIPPED" } }, { id: String(order._id) })));
    await flush();
    expect(mailsOf(/has shipped/)).toHaveLength(1);
  });

  it("is sent after the response, not before", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    await adminCall(orderStatus.PATCH, { method: "PATCH", json: { status: "SHIPPED" } }, { id: String(order._id) });
    expect(sink.state.messages).toHaveLength(0); // the response is done, the task has not run yet
    await flush();
    expect(sink.state.messages).toHaveLength(1);
  });

  it("an unknown status, a bad id or a non-admin changes and sends nothing", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    expect((await setStatus(order._id, { status: "TELEPORTED" })).status).toBe(400);
    expect((await adminCall(orderStatus.PATCH, { method: "PATCH", json: { status: "SHIPPED" }, role: "user" }, { id: String(order._id) })).status).toBe(403);
    await flush();
    expect(sink.state.messages).toHaveLength(0);
  });
});

// ─── 5. cancelled ───────────────────────────────────────────────────────────

describe("cancelled", () => {
  it("says a refund is due and that Razorpay refunds take several working days, without a date", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    expect((await setStatus(order._id, { status: "CANCELLED" })).status).toBe(200);
    expect(sink.state.messages).toHaveLength(1);
    const [m] = mails();
    expect(m.subject).toBe(`Your order ${orderNumber(order._id)} has been cancelled`);
    expect(m.rcptTo.join()).toContain(ACCOUNT);
    for (const body of [m.html, m.text]) {
      expect(body).toContain(`A refund of ${formatMoney(order.totalAmount)} is due to you`);
      expect(body).toContain("Razorpay");
      expect(body).toContain("several working days");
      expect(body).not.toMatch(/\d+\s*(-|to)?\s*\d*\s*(business |working )?days/i); // no promised number of days
      expect(body).not.toMatch(/\b(by|before|on) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2} [A-Z][a-z]{2})/i);
    }
  });

  it("is sent once: cancelling again is refused and sends nothing more", async () => {
    const order = await paidOrder(1);
    await setStatus(order._id, { status: "CANCELLED" });
    expect((await setStatus(order._id, { status: "CANCELLED" })).status).toBe(409);
    expect((await setStatus(order._id, { status: "SHIPPED" })).status).toBe(409);
    expect(mailsOf(/cancelled/)).toHaveLength(1);
    expect(mailsOf(/has shipped/)).toHaveLength(0);
  });

  it("the refund wording follows what is known: unpaid, refunded, not needed, due", () => {
    expect(cancellationRefundWording({ paymentStatus: "UNPAID", refundStatus: undefined, total: 100 })).toMatch(/not charged/);
    expect(cancellationRefundWording({ paymentStatus: "PAID", refundStatus: "REFUNDED", total: 100 })).toMatch(/has been refunded/);
    expect(cancellationRefundWording({ paymentStatus: "PAID", refundStatus: "NOT_NEEDED", total: 100 })).toMatch(/No refund is due/);
    expect(cancellationRefundWording({ paymentStatus: "PAID", refundStatus: "PENDING", total: 1234.5 })).toContain("₹1,234.50 is due");
    expect(cancellationRefundWording({ paymentStatus: "PAID", refundStatus: undefined, total: 100 })).toMatch(/is due to you/);
  });
});

// ─── 6. refund completed ────────────────────────────────────────────────────

describe("refund completed", () => {
  it("is sent when the refund status becomes REFUNDED, not for other refund changes, and only once", async () => {
    const order = await paidOrder(1);
    await setStatus(order._id, { status: "CANCELLED" });
    sink.state.messages.length = 0;

    await setRefund(order._id, { refundStatus: "PENDING", refundNote: "checking" });
    expect(sink.state.messages).toHaveLength(0);
    expect((await setRefund(order._id, { refundStatus: "REFUNDED", razorpayRefundId: "rfnd_abc123" })).status).toBe(200);
    expect(sink.state.messages).toHaveLength(1);
    const [m] = mails();
    expect(m.subject).toBe(`Refund issued for order ${orderNumber(order._id)}`);
    expect(m.rcptTo.join()).toContain(ACCOUNT);
    for (const body of [m.html, m.text]) {
      expect(body).toContain(formatMoney(order.totalAmount));
      expect(body).toContain("several working days");
      expect(body).not.toContain("rfnd_abc123"); // the shop's own reference stays with the shop
    }

    // saving REFUNDED again, or going back and forth, sends nothing more
    await setRefund(order._id, { refundStatus: "REFUNDED", refundNote: "again" });
    await setRefund(order._id, { refundStatus: "PENDING" });
    await setRefund(order._id, { refundStatus: "REFUNDED" });
    expect(mailsOf(/Refund issued/)).toHaveLength(1);
  });

  it("an invalid refund save changes nothing and sends nothing", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    expect((await setRefund(order._id, { refundStatus: "SOON" })).status).toBe(400);
    expect(sink.state.messages).toHaveLength(0);
  });
});

// ─── 7. delivered (optional, off by default) ────────────────────────────────

describe("delivered", () => {
  it("sends nothing while the switch is off (the default), also with no settings saved at all", async () => {
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    expect((await setStatus(order._id, { status: "DELIVERED" })).status).toBe(200);
    expect(sink.state.messages).toHaveLength(0);
    expect((await Settings.create({}))?.emailSettings?.sendDeliveredEmail).toBe(false);
    const o2 = await paidOrder(1);
    sink.state.messages.length = 0;
    await setStatus(o2._id, { status: "DELIVERED" });
    expect(sink.state.messages).toHaveLength(0);
  });

  it("sends one e-mail once the admin switches it on, and not again for the same status", async () => {
    await Settings.create({ emailSettings: { sendDeliveredEmail: true } });
    const order = await paidOrder(1);
    sink.state.messages.length = 0;
    await setStatus(order._id, { status: "DELIVERED" });
    await setStatus(order._id, { status: "DELIVERED" });
    expect(sink.state.messages).toHaveLength(1);
    expect(mails()[0].subject).toBe(`Your order ${orderNumber(order._id)} has been delivered`);
  });
});

// ─── 8. password changed ────────────────────────────────────────────────────

describe("password changed", () => {
  const resetPassword = async (email: string) => {
    await setOtp("reset", email, "123456");
    const res = await reset.POST(new NextRequest("http://localhost/api/auth/forgot-password/reset", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp: "123456", newPassword: "New-Passw0rd!", confirmPassword: "New-Passw0rd!" }),
    }));
    await flush();
    return res;
  };

  it("a short notice goes to the account after a successful reset, with the shop's address and no sign-in link", async () => {
    await Settings.create({ contactPageSettings: { email: "help@shop.test" } });
    expect((await resetPassword(ACCOUNT)).status).toBe(200);
    expect(sink.state.messages).toHaveLength(1);
    const [m] = mails();
    expect(m.subject).toBe("Your Indian Mist password was changed");
    expect(m.rcptTo.join()).toContain(ACCOUNT);
    for (const body of [m.html, m.text]) {
      expect(body).toContain("help@shop.test");
      expect(body).toMatch(/IST/); // when, in the shop's time zone
      expect(body).not.toMatch(/sign-?in|log-?in|reset your password|forgot-password/i);
    }
    const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
    for (const href of hrefs) expect(href).toMatch(/^mailto:|\/privacy-policy$|\/terms-and-conditions$/);
    expect(m.text).not.toContain("New-Passw0rd!");
    expect(m.html).not.toContain("New-Passw0rd!");
  });

  it("a failed reset (wrong code) sends nothing", async () => {
    await setOtp("reset", ACCOUNT, "123456");
    const res = await reset.POST(new NextRequest("http://localhost/api/auth/forgot-password/reset", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ACCOUNT, otp: "000000", newPassword: "New-Passw0rd!", confirmPassword: "New-Passw0rd!" }),
    }));
    await flush();
    expect(res.status).toBe(400);
    expect(sink.state.messages).toHaveLength(0);
    expect(await RefreshToken.countDocuments({})).toBe(0);
  });

  it("a mail failure does not undo the reset, and the notice is retried later", async () => {
    sink.state.mode = "drop";
    expect((await resetPassword(ACCOUNT)).status).toBe(200);
    expect((await logRows("password-changed"))[0]).toMatchObject({ status: "failed", permanent: false });
    sink.state.mode = "ok";
    expect(await sweepFailedEmails(Date.now() + 61_000)).toBe(1);
    expect(mailsOf(/password was changed/)).toHaveLength(1);
  });
});

// ─── 9. escaping and the plain-text part ────────────────────────────────────

describe("values with HTML in them", () => {
  it("a delivery address, name, product, courier and promo code with HTML are escaped in the HTML part and stay literal in the text part", async () => {
    const order = await paidOrder(1);
    await Order.updateOne({ _id: order._id }, {
      $set: {
        customerName: `<script>alert("n")</script> Asha`,
        "shippingAddress.street": `"><img src=x onerror=alert(1)>`,
        "shippingAddress.city": `Pu<b>ne</b> & Co`,
        "items.0.name": `<b>Tee</b> & "co" 'x'`,
        promoCode: `<i>P</i>`,
        discountAmount: 10,
      },
    });
    sink.state.messages.length = 0;
    await setStatus(order._id, { status: "SHIPPED", courier: `<u>Fast</u> & Co`, trackingNumber: `<s>1</s>` });
    const [m] = mails();
    expect(m.html).not.toMatch(/<script|<img src=x|<b>Tee|<b>ne|<i>P|<u>Fast|<s>1/);
    expect(m.html).toContain("&lt;script&gt;alert(&quot;n&quot;)&lt;/script&gt;");
    expect(m.html).toContain("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(m.html).toContain("&lt;b&gt;Tee&lt;/b&gt; &amp; &quot;co&quot; &#39;x&#39;");
    expect(m.html).toContain("&lt;u&gt;Fast&lt;/u&gt; &amp; Co");
    // the plain-text part is text: shown as typed, never as markup
    expect(m.text).toContain(`"><img src=x onerror=alert(1)>`);
    expect(m.text).toContain("<b>Tee</b>");
    expect(m.text).not.toContain("&lt;");
  });

  it("a header-breaking name cannot reach the subject or the headers; the subject is one line", async () => {
    const order = await paidOrder(1);
    await Order.updateOne({ _id: order._id }, { $set: { customerName: "Asha\r\nBcc: attacker@evil.test" } });
    sink.state.messages.length = 0;
    await setStatus(order._id, { status: "SHIPPED" });
    const [m] = mails();
    expect(m.headers.some((h) => /^bcc:/i.test(h))).toBe(false);
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.rcptTo).toHaveLength(1);
  });
});

// ─── 10. non-production guard ───────────────────────────────────────────────

describe("outside production, only the allowlist can be e-mailed", () => {
  it("a test order from a browser run (not production, address not allowed) is created and reaches nobody; the server is not even contacted", async () => {
    delete process.env.VERCEL_ENV;
    process.env.EMAIL_ALLOWLIST = "me@dev.test,@internal.test";
    const rzp = await checkout(1);
    expect((await viaBrowser(rzp, "pay_guard")).status).toBe(200);
    await flush();
    const order = (await Order.findOne({ razorpayOrderId: rzp }))!;
    expect(order.paymentStatus).toBe("PAID");
    expect(sink.state.connections).toBe(0);
    expect(sink.state.messages).toHaveLength(0);
    expect(await EmailLog.countDocuments({})).toBe(0);
    expect(logs.join("\n")).toContain("dropped type=order-confirmation");

    await setStatus(order._id, { status: "SHIPPED" });
    await setStatus(order._id, { status: "CANCELLED" });
    await setRefund(order._id, { refundStatus: "REFUNDED" });
    expect(sink.state.connections).toBe(0);
  });

  it("the allowlist lets an exact address or a whole domain through", async () => {
    delete process.env.VERCEL_ENV;
    process.env.EMAIL_ALLOWLIST = "@acct.test";
    await paidOrder(1);
    expect(sink.state.messages).toHaveLength(1);
  });

  it("EMAIL_ENABLED=false stops every order e-mail, even in production", async () => {
    process.env.EMAIL_ENABLED = "false";
    const order = await paidOrder(1);
    await setStatus(order._id, { status: "SHIPPED" });
    expect(sink.state.connections).toBe(0);
  });

  it("a retry or Resend re-checks the guard: a failed e-mail is not sent once the deployment stops being allowed to send it", async () => {
    sink.state.mode = "drop";
    const order = await paidOrder(1);
    sink.state.mode = "ok";
    delete process.env.VERCEL_ENV;
    process.env.EMAIL_ALLOWLIST = "nobody@dev.test";
    await sweepFailedEmails(Date.now() + 61_000);
    expect(sink.state.messages).toHaveLength(0);
    expect((await logRows("order-confirmation"))[0]).toMatchObject({ status: "failed", permanent: true, lastErrorCode: "EGUARD" });
    expect(order).toBeTruthy();
  });
});

// ─── 11. the admin's view: sent / failed / queued, and Resend ───────────────

describe("the admin order list shows each e-mail and offers Resend for failed ones", () => {
  const listed = async () => {
    const res = await adminCall(ordersList.GET, { method: "GET" });
    return (await res.json()).orders as { _id: string; emails: { id: string; type: string; status: string; permanent: boolean; canResend: boolean; lastErrorCode: string | null }[] }[];
  };

  it("sent e-mails show as sent with no Resend; a permanent failure shows as failed with Resend, and Resend delivers it", async () => {
    const order = await paidOrder(1);
    let row = (await listed()).find((o) => o._id === String(order._id))!;
    expect(row.emails).toEqual([expect.objectContaining({ type: "order-confirmation", status: "sent", canResend: false })]);

    sink.state.mode = "reject-rcpt"; // a 5xx answer: permanent
    await setStatus(order._id, { status: "SHIPPED" });
    row = (await listed()).find((o) => o._id === String(order._id))!;
    const failed = row.emails.find((e) => e.type === "order-shipped")!;
    expect(failed).toMatchObject({ status: "failed", permanent: true, canResend: true, lastErrorCode: "550" });

    sink.state.mode = "ok";
    const res = await adminCall(resendRoute.POST, { method: "POST" }, { id: failed.id });
    expect(res.status).toBe(200);
    expect(mailsOf(/has shipped/)).toHaveLength(1);
    row = (await listed()).find((o) => o._id === String(order._id))!;
    expect(row.emails.find((e) => e.type === "order-shipped")).toMatchObject({ status: "sent", canResend: false });

    // a second click on Resend sends nothing more (it is no longer failed)
    expect((await adminCall(resendRoute.POST, { method: "POST" }, { id: failed.id })).status).toBe(409);
    expect(mailsOf(/has shipped/)).toHaveLength(1);
  });

  it("a retryable failure shows as failed (will retry) and a stuck queued one as queued", async () => {
    const order = await paidOrder(1);
    sink.state.mode = "drop";
    await setStatus(order._id, { status: "SHIPPED" });
    await EmailLog.create({ type: "order-delivered", dedupeKey: `order-delivered:${order._id}`, relatedId: String(order._id), status: "queued", attempts: 0 });
    const row = (await listed()).find((o) => o._id === String(order._id))!;
    expect(row.emails.find((e) => e.type === "order-shipped")).toMatchObject({ status: "failed", permanent: false, canResend: true });
    expect(row.emails.find((e) => e.type === "order-delivered")).toMatchObject({ status: "queued", canResend: false });
  });

  it("Resend that the guard refuses says so (not 'not waiting'), and nothing is sent", async () => {
    const order = await paidOrder(1);
    sink.state.mode = "reject-rcpt";
    await setStatus(order._id, { status: "SHIPPED" });
    const failed = (await listed()).find((o) => o._id === String(order._id))!.emails.find((e) => e.type === "order-shipped")!;
    sink.state.mode = "ok";
    process.env.EMAIL_ENABLED = "false";
    const res = await adminCall(resendRoute.POST, { method: "POST" }, { id: failed.id });
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toMatch(/switched off|not allowed/);
    expect(sink.state.messages.filter((m) => /has shipped/.test(decode(m.raw).subject))).toHaveLength(0);
  });

  it("the dashboard list of failures and the Resend route keep working for order e-mails", async () => {
    const order = await paidOrder(1);
    sink.state.mode = "reject-rcpt";
    await setStatus(order._id, { status: "CANCELLED" });
    const { listFailedEmails } = await import("@/lib/email/admin");
    const { emails, permanentFailures } = await listFailedEmails();
    expect(emails).toEqual([expect.objectContaining({ type: "order-cancelled", permanent: true, canResend: true })]);
    expect(permanentFailures).toBe(1);
    // no recipient address is ever listed
    expect(JSON.stringify(emails)).not.toContain(ACCOUNT);
  });
});

// ─── 12. a deleted order or account cannot be e-mailed ──────────────────────

describe("when there is nothing to send to", () => {
  it("an order whose account is gone sends nothing and is not retried forever", async () => {
    sink.state.mode = "drop";
    const order = await paidOrder(1);
    sink.state.mode = "ok";
    await User.deleteOne({ _id: userId });
    await sweepFailedEmails(Date.now() + 61_000);
    expect(sink.state.messages).toHaveLength(0);
    expect((await logRows("order-confirmation"))[0]).toMatchObject({ status: "failed", permanent: true, lastErrorCode: "ENOSOURCE" });
    expect(order).toBeTruthy();
  });

  it("an id that is not an order is refused quietly", async () => {
    const { sendOrderEmail } = await import("@/lib/email/order-mail");
    const result = await sendOrderEmail("order-shipped", new mongoose.Types.ObjectId());
    expect(result).toMatchObject({ status: "failed", code: "ENOSOURCE" });
    expect((await sendOrderEmail("order-shipped", "not-an-id")).status).toBe("failed");
  });
});

// ─── 13. small pure pieces ──────────────────────────────────────────────────

describe("money and tracking input", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatMoney(0)).toBe("₹0");
    expect(formatMoney(999)).toBe("₹999");
    expect(formatMoney(123456)).toBe("₹1,23,456");
    expect(formatMoney(499.5)).toBe("₹499.50");
    expect(formatMoney(Number.NaN)).toBe("₹0");
  });

  it("tracking input: valid fields are kept, empty clears, junk is reported, absent is untouched", () => {
    expect(parseTracking({})).toEqual({ set: {}, unset: [], ignored: [] });
    expect(parseTracking({ courier: " DTDC ", trackingNumber: "A1\nB2", trackingUrl: "https://t.example.test/x?y=1" })).toEqual({
      set: { courier: "DTDC", trackingNumber: "A1 B2", trackingUrl: "https://t.example.test/x?y=1" }, unset: [], ignored: [],
    });
    expect(parseTracking({ courier: "", trackingUrl: "" })).toEqual({ set: {}, unset: ["courier", "trackingUrl"], ignored: [] });
    expect(parseTracking({ trackingUrl: "ftp://x", courier: 5, trackingNumber: "x".repeat(81) }).ignored.sort()).toEqual(["courier", "trackingNumber", "trackingUrl"]);
    expect(parseTracking({ trackingUrl: "javascript:alert(1)" }).ignored).toEqual(["trackingUrl"]);
  });
});

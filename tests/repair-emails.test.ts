import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { fakeRedis } from "./helpers/redis";
import { razorpayState, signPayment, signWebhook } from "./helpers/razorpay";
import { startSmtpSink, headersOf } from "./helpers/smtp-sink";
import { adminCall } from "./helpers/admin";

// The crash-gap repair pass: real routes and finalizeOrder, real nodemailer, a local fake SMTP server.
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
import { sweepThrottled, resetSweepThrottleForTests } from "@/lib/email/sweep";
import { repairMissingOrderEmails, repairMissingOrderEmailsThrottled, resetRepairThrottleForTests, REPAIR_WINDOW_MS, REPAIR_MIN_GAP_MS } from "@/lib/email/repair";
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
  resetRepairThrottleForTests();
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

// ─── helpers specific to the repair pass ────────────────────────────────────

/** A real paid order whose e-mails were never queued: the server stopped after saving it (the after() tasks are lost). */
async function crashedOrder(paymentId = `pay_c${++n}`) {
  const rzp = await checkout(1);
  expect((await viaBrowser(rzp, paymentId)).status).toBe(200);
  hoisted.afterQueue.length = 0; // the crash
  const order = (await Order.findOne({ razorpayOrderId: rzp }))!;
  expect(await EmailLog.countDocuments({ relatedId: String(order._id) })).toBe(0);
  return order;
}
const LATER = () => Date.now() + 10 * 60_000; // past the grace period
const toCustomer = () => mails().filter((m) => m.rcptTo.join().includes(ACCOUNT));
const age = (id: unknown, ms: number) => Order.collection.updateOne({ _id: id as never }, { $set: { createdAt: new Date(Date.now() - ms) } });

describe("crash gap repair", () => {
  it("a crash between saving the order and queuing: the confirmation and the owner's new-order alert appear after the repair pass", async () => {
    const order = await crashedOrder();
    expect(mails()).toHaveLength(0);
    expect(await repairMissingOrderEmails(LATER())).toBe(1);
    expect(toCustomer()).toHaveLength(1);
    expect(toCustomer()[0].subject).toMatch(new RegExp(String(orderNumber(order._id)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(ownerSubjects(/New order/)).toHaveLength(1);
    expect(await rows("order-confirmation")).toHaveLength(1);
    expect(await rows("owner-new-order")).toHaveLength(1);
  });

  it("repeat runs send nothing more", async () => {
    await crashedOrder();
    expect(await repairMissingOrderEmails(LATER())).toBe(1);
    const sent = mails().length;
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    expect(mails()).toHaveLength(sent);
  });

  it("an order that already has a row (sent, failed for good, or queued) is untouched", async () => {
    const sent = await paidOrder(1);
    const failed = await crashedOrder();
    const queued = await crashedOrder();
    const before = mails().length;
    await EmailLog.create({ type: "order-confirmation", dedupeKey: `order-confirmation:${failed._id}`, relatedId: String(failed._id), status: "failed", permanent: true, attempts: 1, lastErrorCode: "550" });
    await EmailLog.create({ type: "order-confirmation", dedupeKey: `order-confirmation:${queued._id}`, relatedId: String(queued._id), status: "queued", attempts: 0 });
    expect(await EmailLog.countDocuments({ type: "order-confirmation", relatedId: String(sent._id), status: "sent" })).toBe(1);
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    expect(mails()).toHaveLength(before);
    expect((await EmailLog.findOne({ relatedId: String(failed._id), type: "order-confirmation" }))!.status).toBe("failed");
    expect((await EmailLog.findOne({ relatedId: String(queued._id), type: "order-confirmation" }))!.status).toBe("queued");
  });

  it("an owner alert that was capped on purpose (its confirmation was sent) is never brought back", async () => {
    const order = await paidOrder(1);
    await EmailLog.deleteOne({ type: "owner-new-order", relatedId: String(order._id) });
    const before = mails().length;
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    expect(mails()).toHaveLength(before);
    expect(await rows("owner-new-order")).toHaveLength(0);
  });

  it("orders older than 7 days, unpaid, cancelled, or still inside the grace period are ignored", async () => {
    const old = await crashedOrder();
    await age(old._id, REPAIR_WINDOW_MS + 3600_000);
    const unpaid = await crashedOrder();
    await Order.collection.updateOne({ _id: unpaid._id }, { $set: { paymentStatus: "UNPAID" } });
    const cancelled = await crashedOrder();
    await Order.collection.updateOne({ _id: cancelled._id }, { $set: { status: "CANCELLED" } });
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    const fresh = await crashedOrder();
    expect(await repairMissingOrderEmails(Date.now() + 30_000)).toBe(0); // grace
    expect(await repairMissingOrderEmails(LATER())).toBe(1);
    expect(await rows("order-confirmation")).toHaveLength(1);
    expect((await rows("order-confirmation"))[0].relatedId).toBe(String(fresh._id));
  });

  it("is throttled: a second call within 10 minutes does nothing, and it runs from the sweep, not on its own", async () => {
    await crashedOrder();
    const t = Date.now() + 10 * 60_000;
    expect(await repairMissingOrderEmailsThrottled(t)).toBe(1);
    await crashedOrder();
    expect(await repairMissingOrderEmailsThrottled(t + 1000)).toBeNull();
    expect(await repairMissingOrderEmailsThrottled(t + REPAIR_MIN_GAP_MS + 1000)).toBe(1);
    // through the shared sweep
    resetRepairThrottleForTests(); resetSweepThrottleForTests();
    await crashedOrder();
    await sweepThrottled(Date.now() + 10 * 60_000);
    expect(await rows("order-confirmation")).toHaveLength(3);
  });

  it("two instances running the pass at once send each e-mail once", async () => {
    await crashedOrder();
    await Promise.all([repairMissingOrderEmails(LATER()), repairMissingOrderEmails(LATER()), repairMissingOrderEmails(LATER())]);
    expect(toCustomer()).toHaveLength(1);
    expect(ownerSubjects(/New order/)).toHaveLength(1);
  });

  it("the mail server being down keeps the row for the normal retry (no second repair e-mail later)", async () => {
    await crashedOrder();
    sink.state.mode = "drop";
    expect(await repairMissingOrderEmails(LATER())).toBe(1);
    expect(await EmailLog.countDocuments({ type: "order-confirmation", status: "failed" })).toBe(1);
    sink.state.mode = "ok";
    expect(await repairMissingOrderEmails(LATER())).toBe(0); // the row exists: retry is the sweep's job
  });

  it("outside production without an allowlist, or with EMAIL_ENABLED=false, it does nothing", async () => {
    await crashedOrder();
    process.env.VERCEL_ENV = "preview";
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    process.env.EMAIL_ALLOWLIST = "someone-else@x.test"; // an allowlist, but not these recipients
    expect(await repairMissingOrderEmails(LATER())).toBe(1);
    expect(mails()).toHaveLength(0); // each message still goes through the recipient guard
    process.env.VERCEL_ENV = "production";
    process.env.EMAIL_ENABLED = "false";
    expect(await repairMissingOrderEmails(LATER())).toBe(0);
    expect(mails()).toHaveLength(0);
    expect(await EmailLog.countDocuments({})).toBe(0);
  });
});

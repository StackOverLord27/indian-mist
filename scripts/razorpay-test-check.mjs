#!/usr/bin/env node
/**
 * Razorpay TEST MODE check against a locally running app. Not part of the unit tests.
 *
 *   # terminal 1: the app, on a LOCAL Mongo (keep real Upstash and the rzp_test_ keys from .env)
 *   MONGODB_URI='mongodb://127.0.0.1:27018/rzp_check?replicaSet=rs0&directConnection=true' \
 *   JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... npm run build && npx next start -p 3057
 *   # terminal 2: this script, with the SAME MONGODB_URI and JWT_ACCESS_SECRET
 *   node scripts/razorpay-test-check.mjs --app=http://localhost:3057
 *
 * What it does, using the app's real code path:
 *   1. creates a REAL Razorpay test order through POST /api/checkout/create-order and fetches it
 *      from Razorpay to compare amount (paise), currency and receipt;
 *   2. proves a wrong payment signature is rejected, then confirms with the signature Razorpay
 *      would produce (HMAC of "order|payment" with the key secret) via /api/checkout/verify-payment;
 *   3. replays it, and tries it as another user;
 *   4. second order: webhook with a wrong signature (rejected), payment.captured and order.paid
 *      signed with the webhook secret (one order, no duplicate), an unrelated event (200, ignored).
 *
 * It cannot pay inside Razorpay's checkout window or receive a webhook Razorpay itself sends.
 * Refuses to run unless the key starts with rzp_test_ and the database is local. Never prints
 * key values. Test data it creates (local Mongo documents, Redis keys) is removed at the end.
 */
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const appUrl = (process.argv.find((a) => a.startsWith("--app=")) ?? "--app=http://localhost:3057").slice(6).replace(/\/$/, "");
if (!process.env.RAZORPAY_KEY_ID) { try { process.loadEnvFile(".env"); } catch { /* handled below */ } }
const need = (name) => { const v = process.env[name]; if (!v) { console.error(`Missing ${name}`); process.exit(1); } return v; };

const keyId = need("RAZORPAY_KEY_ID");
const keySecret = need("RAZORPAY_KEY_SECRET");
const webhookSecret = need("RAZORPAY_WEBHOOK_SECRET");
for (const [name, v] of [["RAZORPAY_KEY_ID", keyId], ["NEXT_PUBLIC_RAZORPAY_KEY_ID", process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID]]) {
  if (v && !v.startsWith("rzp_test_")) {
    console.error(`REFUSING TO RUN: ${name} does not start with rzp_test_ (prefix: ${v.split("_").slice(0, 2).join("_")}).`);
    process.exit(2);
  }
}
const mongoUri = need("MONGODB_URI");
const host = new URL(mongoUri.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || mongoUri.startsWith("mongodb+srv:")) {
  console.error(`REFUSING TO RUN: MONGODB_URI host "${host}" is not local.`);
  process.exit(2);
}
const accessSecret = need("JWT_ACCESS_SECRET");
console.log(`Key type: ${keyId.split("_").slice(0, 2).join("_")}_… (test mode). Database: local. App: ${appUrl}`);

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const hmac = (secret, text) => createHmac("sha256", secret).update(text).digest("hex");

await mongoose.connect(mongoUri);
const db = mongoose.connection.db;
const tag = `rzpcheck-${Date.now()}`;
const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();
const token = (id) => jwt.sign({ userId: String(id), email: `${tag}@example.test`, role: "user" }, accessSecret, { expiresIn: "15m", algorithm: "HS256" });

const product = (await db.collection("products").insertOne({
  name: `Razorpay check ${tag}`, slug: tag, description: "temporary", category: "check", price: 249.5,
  images: [{ url: "https://placehold.co/80", publicId: "check/1", alt: "", isPrimary: true }],
  sizes: [], colors: [], trackInventory: true, stockQuantity: 10, order: 0, createdAt: new Date(), updatedAt: new Date(),
})).insertedId;
const stock = async () => (await db.collection("products").findOne({ _id: product })).stockQuantity;

const post = async (path, { user, body, raw, headers = {} }) => {
  const res = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(user ? { cookie: `access_token=${token(user)}` } : {}), ...headers },
    body: raw ?? JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json };
};
const checkoutBody = (qty) => ({
  items: [{ productId: String(product), quantity: qty }],
  customerName: "Razorpay Check", email: "check@example.test", phone: "9999999999",
  shippingAddress: { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001" },
});
const fromRazorpay = async (orderId) => {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` } });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const orderCount = (razorpayOrderId) => db.collection("orders").countDocuments({ razorpayOrderId });
const createdIds = [];

try {
  // ── 1. A real Test Mode order through the app ──
  const created = await post("/api/checkout/create-order", { user: userA, body: checkoutBody(2) });
  check("create-order answers 200", created.status === 200, `status ${created.status}`);
  const rzpOrderId = created.json?.razorpayOrderId;
  check("got a Razorpay order id", typeof rzpOrderId === "string" && rzpOrderId.startsWith("order_"));
  createdIds.push(rzpOrderId);
  // 2 x 249.50 = 499.00, below the free-shipping threshold, so + 99.00 shipping = 598.00 = 59800 paise
  const wantPaise = 59800;
  check("response amount is whole paise", Number.isInteger(created.json?.amount), `${created.json?.amount}`);
  const remote = await fromRazorpay(rzpOrderId);
  check("Razorpay has the order", remote.status === 200 && remote.json?.id === rzpOrderId, `status ${remote.status}`);
  check("amount at Razorpay equals the total in paise", remote.json?.amount === wantPaise, `${remote.json?.amount} vs ${wantPaise}`);
  check("currency is INR", remote.json?.currency === "INR");
  check("receipt is set by the app", typeof remote.json?.receipt === "string" && remote.json.receipt.startsWith("order_"), remote.json?.receipt);
  check("order status at Razorpay is 'created'", remote.json?.status === "created");
  check("stock held (10 -> 8)", (await stock()) === 8, `${await stock()}`);

  // ── 2. Payment confirmation signature ──
  const paymentId = `pay_check${Date.now()}`;
  const wrong = await post("/api/checkout/verify-payment", { user: userA, body: { razorpayOrderId: rzpOrderId, razorpayPaymentId: paymentId, razorpaySignature: hmac("not-the-secret", `${rzpOrderId}|${paymentId}`) } });
  check("wrong signature rejected (400)", wrong.status === 400, `status ${wrong.status}`);
  const shortSig = await post("/api/checkout/verify-payment", { user: userA, body: { razorpayOrderId: rzpOrderId, razorpayPaymentId: paymentId, razorpaySignature: "abc" } });
  check("wrong-length signature rejected (400)", shortSig.status === 400);
  check("no order created by the bad attempts", (await orderCount(rzpOrderId)) === 0);

  const goodSig = hmac(keySecret, `${rzpOrderId}|${paymentId}`);
  const body = { razorpayOrderId: rzpOrderId, razorpayPaymentId: paymentId, razorpaySignature: goodSig };
  const other = await post("/api/checkout/verify-payment", { user: userB, body });
  check("another user cannot confirm this order (403)", other.status === 403, `status ${other.status}`);
  const ok = await post("/api/checkout/verify-payment", { user: userA, body });
  check("correct signature accepted (200)", ok.status === 200 && ok.json?.paymentStatus === "PAID", `status ${ok.status}`);
  const stored = await db.collection("orders").findOne({ razorpayOrderId: rzpOrderId });
  check("order saved as PAID with the right total", stored?.paymentStatus === "PAID" && stored?.totalAmount * 100 === wantPaise, `${stored?.totalAmount}`);
  check("stock stays deducted once (8)", (await stock()) === 8);
  const replay = await post("/api/checkout/verify-payment", { user: userA, body });
  check("replay answers 200 without a second order", replay.status === 200 && (await orderCount(rzpOrderId)) === 1);
  check("stock unchanged after replay (8)", (await stock()) === 8);

  // ── 3. Webhook ──
  const second = await post("/api/checkout/create-order", { user: userB, body: checkoutBody(1) });
  const rzp2 = second.json?.razorpayOrderId;
  createdIds.push(rzp2);
  check("second Razorpay test order created", second.status === 200 && typeof rzp2 === "string", `status ${second.status}`);
  const payment2 = `pay_hook${Date.now()}`;
  const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: payment2, order_id: rzp2 } } } });
  const send = (raw, signature) => post("/api/webhooks/razorpay", { raw, headers: { "x-razorpay-signature": signature } });

  const badHook = await send(captured, hmac("not-the-webhook-secret", captured));
  check("webhook with a wrong signature rejected (400)", badHook.status === 400, `status ${badHook.status}`);
  const noSig = await send(captured, "");
  check("webhook with no signature rejected (400)", noSig.status === 400);
  check("no order created by the bad webhooks", (await orderCount(rzp2)) === 0);

  const goodHook = await send(captured, hmac(webhookSecret, captured));
  check("signed payment.captured accepted (200)", goodHook.status === 200, `status ${goodHook.status}`);
  check("webhook created exactly one PAID order", (await orderCount(rzp2)) === 1);
  const paidEvent = JSON.stringify({ event: "order.paid", payload: { payment: { entity: { id: payment2, order_id: rzp2 } }, order: { entity: { id: rzp2 } } } });
  const paidHook = await send(paidEvent, hmac(webhookSecret, paidEvent));
  check("order.paid for the same order accepted (200)", paidHook.status === 200);
  const repeat = await send(captured, hmac(webhookSecret, captured));
  check("replayed webhook accepted (200)", repeat.status === 200);
  check("still exactly one order, stock deducted once (7)", (await orderCount(rzp2)) === 1 && (await stock()) === 7, `stock ${await stock()}`);
  const browserAfter = await post("/api/checkout/verify-payment", { user: userB, body: { razorpayOrderId: rzp2, razorpayPaymentId: payment2, razorpaySignature: hmac(keySecret, `${rzp2}|${payment2}`) } });
  check("browser confirmation after the webhook reuses the order (200)", browserAfter.status === 200 && (await orderCount(rzp2)) === 1);

  const unrelated = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_x", order_id: rzp2 } } } });
  const ignored = await send(unrelated, hmac(webhookSecret, unrelated));
  check("unrelated event ignored with 200", ignored.status === 200 && ignored.json?.ignored === "payment.failed");
} finally {
  // ── Clean up everything this run created locally ──
  await db.collection("orders").deleteMany({ razorpayOrderId: { $in: createdIds.filter(Boolean) } });
  await db.collection("stockreservations").deleteMany({ razorpayOrderId: { $in: createdIds.filter(Boolean) } });
  await db.collection("stockreservations").deleteMany({ userId: { $in: [userA, userB] } });
  await db.collection("products").deleteOne({ _id: product });
  try {
    const { Redis } = await import("@upstash/redis").catch(() => ({ Redis: require("@upstash/redis").Redis }));
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    for (const id of createdIds.filter(Boolean)) await redis.del(`pending_order_${id}`);
    // the "checkouts started per hour" counters of the two test accounts and of this machine's address
    await redis.del(`checkout_start:user:${userA}`, `checkout_start:user:${userB}`, "checkout_start:ip:unknown");
  } catch { /* nothing to clean or Redis not reachable from the script */ }
  await mongoose.disconnect();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Direct access to the LOCAL e2e database: seeding and checking what the app stored.
 * Users are created directly (hashed password, already verified), exactly as the sign-in form
 * expects them; everything else the tests do goes through the real UI.
 */
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
import { MONGO_URI, CUSTOMER_A, CUSTOMER_B, ADMIN, assertSafe } from "./env.ts";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose") as typeof import("mongoose");

let connected: Promise<unknown> | null = null;
export async function db() {
  assertSafe();
  connected ??= mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await connected;
  return mongoose.connection.db!;
}
export async function closeDb() {
  if (connected) { await mongoose.disconnect(); connected = null; }
}
export const oid = (id?: string) => new mongoose.Types.ObjectId(id);

const PRODUCT_IMAGE = { url: "https://placehold.co/400x500/png", publicId: "indian-mist/e2e/placeholder", alt: "", isPrimary: true };

/**
 * Makes sure the three accounts exist (created directly, hashed password, already verified).
 * Existing accounts keep their id, so saved browser sessions stay valid between runs.
 */
export async function seedUsers() {
  const d = await db();
  const users = d.collection("users");
  const now = new Date();
  for (const u of [CUSTOMER_A, CUSTOMER_B, ADMIN] as { email: string; password: string; name: string; phone?: string }[]) {
    await users.updateOne(
      { email: u.email },
      { $set: { name: u.name, phone: u.phone ?? "", password: await bcrypt.hash(u.password, 10), isVerified: true, role: "user", updatedAt: now }, $setOnInsert: { email: u.email, createdAt: now } },
      { upsert: true },
    );
  }
  const find = async (email: string) => String((await users.findOne({ email }))!._id);
  return { customerA: await find(CUSTOMER_A.email), customerB: await find(CUSTOMER_B.email), admin: await find(ADMIN.email) };
}

export type Seeded = {
  sized: { id: string; slug: string; name: string; price: number };
  plain: { id: string; slug: string; name: string; price: number };
  last: { id: string; slug: string; name: string; price: number };
  promoCode: string;
};

/** Fresh catalogue, settings (shipping + one promo code), and no orders or holds. */
export async function resetShop(): Promise<Seeded> {
  const d = await db();
  await Promise.all(["products", "orders", "stockreservations", "sitesettings", "settings", "categories"].map((c) => d.collection(c).deleteMany({})));
  const run = Math.random().toString(36).slice(2, 8);
  const now = new Date();
  const base = { description: "Seeded for the end-to-end tests.", category: "e2e-tees", images: [PRODUCT_IMAGE], colors: [], features: [], tags: [], materials: [], isActive: true, trackInventory: true, order: 0, createdAt: now, updatedAt: now };
  const docs = [
    { ...base, name: "E2E Sized Tee", slug: `e2e-sized-tee-${run}`, price: 600, sizes: ["S", "M", "L"], sizeStock: [{ size: "S", quantity: 3 }, { size: "M", quantity: 3 }, { size: "L", quantity: 3 }], stockQuantity: 9 },
    { ...base, name: "E2E Plain Cap", slug: `e2e-plain-cap-${run}`, price: 400, sizes: [], sizeStock: [], stockQuantity: 10 },
    { ...base, name: "E2E Last One", slug: `e2e-last-one-${run}`, price: 1200, sizes: [], sizeStock: [], stockQuantity: 1 },
  ];
  const res = await d.collection("products").insertMany(docs);
  await d.collection("categories").insertOne({ name: "E2E Tees", slug: "e2e-tees", order: 0, isFeatured: false, isHidden: false, createdAt: now, updatedAt: now });
  await d.collection("sitesettings").insertOne({
    pricingSettings: {
      shippingCost: 99, freeShippingThreshold: 999, gstRate: 0, showPricesInclusiveOfGst: false,
      promoCodes: [{ code: "E2E10", discountType: "PERCENTAGE", discountValue: 10, isActive: true, minOrderValue: 0, maxUses: 0, maxUsesPerUser: 1, description: "e2e", expiresAt: null, createdAt: now }],
    },
    createdAt: now, updatedAt: now,
  });
  const pick = (i: number) => ({ id: String(res.insertedIds[i]), slug: docs[i].slug, name: docs[i].name, price: docs[i].price });
  return { sized: pick(0), plain: pick(1), last: pick(2), promoCode: "E2E10" };
}

export async function product(id: string) {
  return (await (await db()).collection("products").findOne({ _id: oid(id) }))!;
}
export async function ordersFor(razorpayOrderId?: string) {
  const filter = razorpayOrderId ? { razorpayOrderId } : {};
  return (await db()).collection("orders").find(filter).toArray();
}
export async function reservations() {
  return (await db()).collection("stockreservations").find({}).toArray();
}

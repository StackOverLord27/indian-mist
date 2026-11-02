#!/usr/bin/env node
/**
 * Fills a LOCAL database with test data for checking pagination by hand.
 *
 *   MONGODB_URI='mongodb://127.0.0.1:27018/seed_check?replicaSet=rs0&directConnection=true' \
 *     node scripts/seed-local.mjs [--products=260] [--orders=120] [--blogs=60] [--collections=3] [--reset]
 *
 * Refuses to run unless the database host is localhost / 127.0.0.1 / ::1, whatever else is set.
 * Everything it creates is tagged (slug prefix "seed-", email seed@example.test) and every
 * product keeps order 0, like a catalogue that was never reordered. --reset removes the tagged data first.
 * Does not touch Cloudinary: images point at a placeholder URL.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Set MONGODB_URI to a local database."); process.exit(1); }
let host;
try { host = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).hostname; } catch { host = ""; }
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || uri.startsWith("mongodb+srv:")) {
  console.error(`Refusing to seed "${host || "unknown host"}": this script only works on a local database.`);
  process.exit(1);
}

const arg = (name, fallback) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  const n = a ? Number(a.split("=")[1]) : fallback;
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};
const reset = process.argv.includes("--reset");
const nProducts = arg("products", 260);
const nOrders = arg("orders", 120);
const nBlogs = arg("blogs", 60);
const nCollections = arg("collections", 3);

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Seeding database "${db.databaseName}" on ${host}`);

if (reset) {
  await db.collection("products").deleteMany({ slug: /^seed-/ });
  await db.collection("categories").deleteMany({ slug: /^seed-/ });
  await db.collection("collections").deleteMany({ slug: /^seed-/ });
  await db.collection("blogs").deleteMany({ slug: /^seed-/ });
  await db.collection("orders").deleteMany({ email: "seed@example.test" });
}

const now = Date.now();
const cats = ["tees", "hoodies", "caps", "bags"].map((slug, i) => ({
  name: `Seed ${slug}`, slug: `seed-${slug}`, order: 0, isFeatured: false, isHidden: false,
  createdAt: new Date(now - i * 1000), updatedAt: new Date(),
}));
await db.collection("categories").insertMany(cats);

const colourGroups = ["sage", "moss", "ink", "clay", ""];
const products = Array.from({ length: nProducts }, (_, i) => ({
  name: `Seed Product ${String(i + 1).padStart(3, "0")}`,
  slug: `seed-product-${i + 1}`,
  category: cats[i % cats.length].slug,
  price: 499 + (i % 40) * 50,
  description: "Seeded product for pagination checks.",
  features: [], tags: [], materials: [], sizes: ["S", "M", "L"],
  colorGroup: colourGroups[i % colourGroups.length],
  isActive: true, isFeatured: false, trackInventory: false,
  order: 0, // never reordered: the hard case for stable paging
  // Many share the same creation millisecond on purpose
  createdAt: new Date(now - Math.floor(i / 10) * 60_000), updatedAt: new Date(),
  images: [
    { url: `https://placehold.co/80x80?text=${i + 1}`, publicId: `seed/${i + 1}-a`, alt: "", isPrimary: true },
    { url: `https://placehold.co/80x80?text=${i + 1}b`, publicId: `seed/${i + 1}-b`, alt: "", isPrimary: false },
  ],
}));
const inserted = await db.collection("products").insertMany(products);
const productIds = Object.values(inserted.insertedIds);

if (nCollections) {
  await db.collection("collections").insertMany(
    Array.from({ length: nCollections }, (_, i) => ({
      name: `Seed Collection ${i + 1}`, slug: `seed-collection-${i + 1}`, description: "", isActive: true, order: i,
      products: productIds.slice(i * 20, i * 20 + 30),
      createdAt: new Date(now - i * 1000), updatedAt: new Date(),
    })),
  );
}

if (nBlogs) {
  await db.collection("blogs").insertMany(
    Array.from({ length: nBlogs }, (_, i) => ({
      title: `Seed Post ${i + 1}`, slug: `seed-post-${i + 1}`, excerpt: "Seeded.", content: "<p>Seeded.</p>",
      category: "seed", tags: [], author: "Seed", isPublished: i % 3 !== 0,
      coverImage: { url: "https://placehold.co/80x50", publicId: `seed/blog-${i + 1}`, alt: "" },
      createdAt: new Date(now - i * 3_600_000), updatedAt: new Date(),
    })),
  );
}

if (nOrders) {
  const statuses = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
  await db.collection("orders").insertMany(
    Array.from({ length: nOrders }, (_, i) => ({
      userId: new mongoose.Types.ObjectId(), customerName: `Seed Customer ${i + 1}`, email: "seed@example.test", phone: "9999999999",
      items: [{ productId: productIds[i % productIds.length], name: `Seed Product ${(i % nProducts) + 1}`, quantity: 1, priceAtPurchase: 499, image: "" }],
      subtotal: 499, shippingCost: 0, taxAmount: 0, discountAmount: 0, totalAmount: 499,
      shippingAddress: { street: "1 Test Road", city: "Pune", state: "MH", zipCode: "411001", country: "India" },
      paymentStatus: "PAID", status: statuses[i % statuses.length], razorpayOrderId: `seed_order_${i}`,
      createdAt: new Date(now - i * 600_000), updatedAt: new Date(),
    })),
  );
}

console.log(`Created ${nProducts} products, ${cats.length} categories, ${nCollections} collections, ${nBlogs} blogs, ${nOrders} orders.`);
await mongoose.disconnect();

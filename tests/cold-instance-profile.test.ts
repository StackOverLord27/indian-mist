import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";

// IMPORTANT: this file never imports the Product (or Collection) model itself. A real server
// instance only knows the models its own routes import, and /api/profile used to answer 500 for
// every customer who had orders when it had not seen the Product model yet
// (MissingSchemaError on populate). The seed data goes in through the raw collections.
import * as profile from "@/app/api/profile/route";

setupTestDb();

const col = (name: string) => mongoose.connection.db!.collection(name);
const oid = () => new mongoose.Types.ObjectId();
const PHOTOS = Array.from({ length: 6 }, (_, i) => ({ url: `https://x/p${i}.jpg`, publicId: `p${i}`, alt: "", isPrimary: i === 0 }));

async function seed(orderCount = 3) {
  const userId = oid();
  const productId = oid();
  await col("users").insertOne({ _id: userId, name: "Ada", email: "ada@example.test", password: "hash", isVerified: true });
  await col("products").insertOne({ _id: productId, name: "Linen Shirt", slug: "linen-shirt", price: 800, images: PHOTOS, category: "tees" });
  await col("orders").insertMany(Array.from({ length: orderCount }, (_, i) => ({
    userId, status: "PROCESSING", paymentStatus: "PAID", totalAmount: 800, razorpayOrderId: `order_${i}`, razorpayPaymentId: `pay_${i}`,
    razorpaySignature: "sig", reviewNote: "internal", createdAt: new Date(Date.now() - i * 1000),
    items: [{ productId, name: "Linen Shirt", quantity: 1, priceAtPurchase: 800 }],
  })));
  return { userId: String(userId), productId };
}
const get = (userId: string, query = "") =>
  profile.GET(new NextRequest(`http://localhost/api/profile${query}`, { headers: { "x-user-id": userId } }), { params: Promise.resolve({}) });

describe("/api/profile on a server instance that has not loaded the Product model", () => {
  it("answers 200 with the orders and their products (it used to answer 500)", async () => {
    const { userId } = await seed();
    const res = await get(userId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(3);
    expect(body.orders[0].items[0].productId).toMatchObject({ name: "Linen Shirt", slug: "linen-shirt", price: 800 });
  });

  it("sends only the FIRST photo of each product (the page shows one), and no internals", async () => {
    const { userId } = await seed(1);
    const body = await (await get(userId)).json();
    expect(body.orders[0].items[0].productId.images).toHaveLength(1);
    expect(body.orders[0]).not.toHaveProperty("razorpaySignature");
    expect(body.orders[0]).not.toHaveProperty("razorpayPaymentId");
    expect(body.orders[0]).not.toHaveProperty("reviewNote");
    expect(body.user).not.toHaveProperty("password");
  });

  it("?orders=0 (the checkout's pre-fill) returns the saved details without the order history", async () => {
    const { userId } = await seed();
    const body = await (await get(userId, "?orders=0")).json();
    expect(body.user.email).toBe("ada@example.test");
    expect(body.orders).toEqual([]);
  });

  it("is never cached: a status change the shop makes shows on the next load", async () => {
    const { userId } = await seed(1);
    const res = await get(userId);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(res.headers.get("cache-control")).toMatch(/private/);
  });

  it("an unknown account is 404 and a missing identity is 401", async () => {
    expect((await get(String(oid()))).status).toBe(404);
    const noId = await profile.GET(new NextRequest("http://localhost/api/profile"), { params: Promise.resolve({}) });
    expect(noId.status).toBe(401);
  });

  it("caps the history at the latest 50 orders", async () => {
    const { userId } = await seed(60);
    const body = await (await get(userId)).json();
    expect(body.orders).toHaveLength(50);
  });
});

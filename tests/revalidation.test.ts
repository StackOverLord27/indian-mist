import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";
import { cloudinaryCalls } from "./helpers/cloudinary";
import { fakeRedis } from "./helpers/redis";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import { revalidatePath } from "next/cache";
import { Product } from "@/models/product.model";
import { Category } from "@/models/category.model";
import { Collection } from "@/models/collection.model";
import Announcement from "@/models/announcement.model";
import Carousel from "@/models/carousel.model";
import { Blog } from "@/models/blog.model";
import { Order } from "@/models/order.model";
import * as announcements from "@/app/api/admin/announcements/route";
import * as announcementById from "@/app/api/admin/announcements/[id]/route";
import * as announcementReorder from "@/app/api/admin/announcements/reorder/route";
import * as carouselReorder from "@/app/api/admin/carousel/reorder/route";
import * as carouselById from "@/app/api/admin/carousel/[id]/route";
import * as categories from "@/app/api/admin/categories/route";
import * as categoryById from "@/app/api/admin/categories/[id]/route";
import * as categoryReorder from "@/app/api/admin/categories/reorder/route";
import * as collections from "@/app/api/admin/collections/route";
import * as collectionById from "@/app/api/admin/collections/[id]/route";
import * as productById from "@/app/api/admin/products/[id]/route";
import * as productReorder from "@/app/api/admin/products/reorder/route";
import * as settings from "@/app/api/admin/settings/route";
import * as about from "@/app/api/admin/about/route";
import * as sizeChart from "@/app/api/admin/size-chart/route";
import * as blogs from "@/app/api/admin/blogs/route";
import * as blogById from "@/app/api/admin/blogs/[id]/route";
import * as orderStatus from "@/app/api/admin/orders/[id]/status/route";
import { finalizeOrder } from "@/lib/finalize-order";
import { revalidateStorefront } from "@/lib/revalidate-storefront";

setupTestDb();

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

function request(opts: { method: string; json?: unknown; form?: Record<string, string | Blob>; role?: string }) {
  const headers = new Headers({ "x-user-role": opts.role ?? "admin", "x-user-id": "u1", "x-user-email": "a@b.c" });
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers.set("content-type", "application/json");
  }
  if (opts.form) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(opts.form)) fd.append(k, v);
    body = fd;
  }
  return new NextRequest("http://localhost/api/test", { method: opts.method, headers, body });
}

const call = (h: Handler, opts: Parameters<typeof request>[0], params: Record<string, string> = {}) =>
  h(request(opts), { params: Promise.resolve(params) });

const LAYOUT = ["/", "layout"];
const layoutRevalidations = () =>
  vi.mocked(revalidatePath).mock.calls.filter((c) => c[0] === "/" && c[1] === "layout").length;

// A real 1x1 PNG so validateImageFile accepts it
const PNG = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64")], { type: "image/png" });

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  cloudinaryCalls.reset();
  fakeRedis.reset();
});

describe("revalidateStorefront", () => {
  it("revalidates the root layout (everything under it)", () => {
    revalidateStorefront();
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([LAYOUT]);
  });
});

describe("admin mutations refresh the whole storefront", () => {
  it("announcements: create, update, delete, reorder", async () => {
    const created = await call(announcements.POST, { method: "POST", json: { text: "Free shipping" } });
    expect(created.status).toBe(201);
    const id = String((await created.json()).announcement._id);
    expect(layoutRevalidations()).toBe(1);

    expect((await call(announcementById.PUT, { method: "PUT", json: { isActive: false } }, { id })).status).toBe(200);
    expect(layoutRevalidations()).toBe(2);

    expect((await call(announcementReorder.PUT, { method: "PUT", json: { items: [{ id, order: 0 }] } })).status).toBe(200);
    expect(layoutRevalidations()).toBe(3);

    expect((await call(announcementById.DELETE, { method: "DELETE" }, { id })).status).toBe(200);
    expect(layoutRevalidations()).toBe(4);
  });

  it("does not revalidate when the change was rejected", async () => {
    const res = await call(announcements.POST, { method: "POST", json: { text: "" } });
    expect(res.status).toBe(400);
    expect(layoutRevalidations()).toBe(0);
    const missing = await call(announcementById.PUT, { method: "PUT", json: { isActive: true } }, { id: String(new mongoose.Types.ObjectId()) });
    expect(missing.status).toBe(404);
    expect(layoutRevalidations()).toBe(0);
  });

  it("non-admins are rejected before anything changes", async () => {
    const res = await call(announcements.POST, { method: "POST", json: { text: "x" }, role: "user" });
    expect(res.status).toBe(403);
    expect(layoutRevalidations()).toBe(0);
    expect(await Announcement.countDocuments()).toBe(0);
  });

  it("categories: create, update, delete, reorder", async () => {
    const created = await call(categories.POST, { method: "POST", form: { name: "Tees" } });
    expect(created.status).toBe(201);
    const id = String((await created.json()).category._id);
    expect(layoutRevalidations()).toBe(1);
    await call(categoryById.PUT, { method: "PUT", form: { name: "T-Shirts" } }, { id });
    expect(layoutRevalidations()).toBe(2);
    await call(categoryReorder.PUT, { method: "PUT", json: { orderedIds: [id] } });
    expect(layoutRevalidations()).toBe(3);
    await call(categoryById.DELETE, { method: "DELETE" }, { id });
    expect(layoutRevalidations()).toBe(4);
    expect(await Category.countDocuments()).toBe(0);
  });

  it("collections: create, update, delete", async () => {
    const created = await call(collections.POST, { method: "POST", json: { name: "Summer" } });
    expect(created.status).toBe(201);
    const id = String((await created.json()).collection._id);
    expect(layoutRevalidations()).toBe(1);
    await call(collectionById.PUT, { method: "PUT", json: { name: "Winter" } }, { id });
    expect(layoutRevalidations()).toBe(2);
    await call(collectionById.DELETE, { method: "DELETE" }, { id });
    expect(layoutRevalidations()).toBe(3);
    expect(await Collection.countDocuments()).toBe(0);
  });

  it("products: update, reorder, delete", async () => {
    const product = await Product.create({
      name: "Tee", slug: "tee", description: "d", category: "tees", price: 100,
      images: [{ url: "https://x/y.jpg", publicId: "p/1", isPrimary: true }],
    });
    const id = String(product._id);
    const updated = await call(productById.PUT, { method: "PUT", form: { price: "150" } }, { id });
    expect(updated.status).toBe(200);
    expect(layoutRevalidations()).toBe(1);
    await call(productReorder.PUT, { method: "PUT", json: { orderedIds: [id] } });
    expect(layoutRevalidations()).toBe(2);
    await call(productById.DELETE, { method: "DELETE" }, { id });
    expect(layoutRevalidations()).toBe(3);
    expect(cloudinaryCalls.destroys).toEqual(["p/1"]);
  });

  it("carousel: reorder and delete", async () => {
    const item = await Carousel.create({ url: "https://x/c.jpg", publicId: "c/1" });
    const id = String(item._id);
    await call(carouselReorder.PUT, { method: "PUT", json: { orderedIds: [id] } });
    expect(layoutRevalidations()).toBe(1);
    await call(carouselById.DELETE, { method: "DELETE" }, { id });
    expect(layoutRevalidations()).toBe(2);
  });

  it("settings and about", async () => {
    expect((await call(settings.PUT, { method: "PUT", json: { tagline: "Hello" } })).status).toBe(200);
    expect(layoutRevalidations()).toBe(1);
    expect((await call(about.PUT, { method: "PUT", json: { mission: { heading: "Why" } } })).status).toBe(200);
    expect(layoutRevalidations()).toBe(2);
  });

  it("size chart: upload and delete", async () => {
    const up = await call(sizeChart.PUT, { method: "PUT", form: { image: new File([PNG], "chart.png", { type: "image/png" }) } });
    expect(up.status).toBe(200);
    expect(layoutRevalidations()).toBe(1);
    await call(sizeChart.DELETE, { method: "DELETE" });
    expect(layoutRevalidations()).toBe(2);
  });

  it("blogs: create, update, delete", async () => {
    const created = await call(blogs.POST, {
      method: "POST",
      form: { title: "Trail notes", excerpt: "Short", content: "<p>Body text that is long enough.</p>", category: "Tips", isPublished: "true" },
    });
    expect(created.status).toBe(201);
    const id = String((await created.json()).blog._id);
    expect(layoutRevalidations()).toBe(1);
    await call(blogById.PUT, { method: "PUT", form: { title: "Trail notes 2" } }, { id });
    expect(layoutRevalidations()).toBe(2);
    await call(blogById.DELETE, { method: "DELETE" }, { id });
    expect(layoutRevalidations()).toBe(3);
    expect(await Blog.countDocuments()).toBe(0);
  });
});

async function paidOrder() {
  const product = await Product.create({
    name: "Tee", slug: "tee", description: "d", category: "tees", price: 100,
    images: [{ url: "https://x/y.jpg", publicId: "p/1" }], trackInventory: true, stockQuantity: 5,
  });
  return Order.create({
    userId: new mongoose.Types.ObjectId(),
    items: [{ productId: product._id, name: "Tee", quantity: 1, priceAtPurchase: 100 }],
    status: "PROCESSING", paymentStatus: "PAID", totalAmount: 100,
    customerName: "A", email: "a@b.c", phone: "9999999999",
    shippingAddress: { street: "s", city: "c", state: "st", zipCode: "123456", country: "India" },
  });
}

describe("shop activity refreshes product pages (not the whole site)", () => {
  it("cancelling a paid order refreshes the product pages", async () => {
    const order = await paidOrder();
    const res = await call(orderStatus.PATCH, { method: "PATCH", json: { status: "CANCELLED" } }, { id: String(order._id) });
    expect(res.status).toBe(200);
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c.join(" "));
    expect(paths).toContain("/products/[slug] page");
    expect(paths).toContain("/");
    expect(layoutRevalidations()).toBe(0);
  });

  it("a paid checkout refreshes product pages, and a revalidation failure never fails the order", async () => {
    const product = await Product.create({
      name: "Tee", slug: "tee2", description: "d", category: "tees", price: 100,
      images: [{ url: "https://x/y.jpg", publicId: "p/1" }],
    });
    const userId = String(new mongoose.Types.ObjectId());
    const pending = (n: string) => ({
      userId, items: [{ productId: String(product._id), name: "Tee", quantity: 1, priceAtPurchase: 100 }],
      totalAmount: 100, subtotal: 100, shippingCost: 0, taxAmount: 0, discountAmount: 0, promoCode: null,
      customerName: "A", email: "a@b.c", phone: "9999999999",
      shippingAddress: { street: "s", city: "c", state: "st", zipCode: "123456", country: "India" }, n,
    });
    await fakeRedis.set("pending_order_order_1", pending("1"), { ex: 1800 });
    const first = await finalizeOrder({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_1" });
    expect(first.ok).toBe(true);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c.join(" "))).toContain("/products/[slug] page");

    await fakeRedis.set("pending_order_order_2", pending("2"), { ex: 1800 });
    vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("outside a request"); });
    const second = await finalizeOrder({ razorpayOrderId: "order_2", razorpayPaymentId: "pay_2" });
    expect(second.ok).toBe(true);
    expect(await Order.countDocuments({ paymentStatus: "PAID" })).toBe(2);
  });
});

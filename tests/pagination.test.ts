import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDb } from "./helpers/mongo";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock());
vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());

import { Product } from "@/models/product.model";
import { Category } from "@/models/category.model";
import { Collection } from "@/models/collection.model";
import { Blog } from "@/models/blog.model";
import { Order } from "@/models/order.model";
import { parsePagination, paginationMeta, escapeRegex, searchTerm } from "@/lib/pagination";
import * as products from "@/app/api/admin/products/route";
import * as productReorder from "@/app/api/admin/products/reorder/route";
import * as colorGroups from "@/app/api/admin/products/color-groups/route";
import * as categories from "@/app/api/admin/categories/route";
import * as categoryReorder from "@/app/api/admin/categories/reorder/route";
import * as collections from "@/app/api/admin/collections/route";
import * as collectionById from "@/app/api/admin/collections/[id]/route";
import * as blogs from "@/app/api/admin/blogs/route";
import * as orders from "@/app/api/admin/orders/route";
import { PRODUCT_SORT } from "@/lib/product-sort";

setupTestDb();

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
function call(h: Handler, url: string, opts: { method?: string; json?: unknown; role?: string; id?: string } = {}) {
  const headers = new Headers({ "x-user-role": opts.role ?? "admin", "x-user-id": "u1", "x-user-email": "a@b.c" });
  if (opts.json !== undefined) headers.set("content-type", "application/json");
  const req = new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });
  return h(req, { params: Promise.resolve({ id: opts.id ?? "" }) });
}

const qs = (s: string) => new URLSearchParams(s);

describe("pagination helpers", () => {
  it("defaults to page 1, 50 per page", () => {
    expect(parsePagination(qs(""))).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it("never produces NaN, 0 or negative values", () => {
    for (const bad of ["abc", "", "0", "-5", "1.5", "NaN", "Infinity", "1e3", " ", "99999999999999999999"]) {
      const p = parsePagination(qs(`page=${encodeURIComponent(bad)}&limit=${encodeURIComponent(bad)}`));
      expect(Number.isInteger(p.page) && p.page >= 1).toBe(true);
      expect(Number.isInteger(p.limit) && p.limit >= 1 && p.limit <= 100).toBe(true);
      expect(Number.isInteger(p.skip) && p.skip >= 0).toBe(true);
    }
    expect(parsePagination(qs("page=abc&limit=abc"))).toEqual({ page: 1, limit: 50, skip: 0 });
    expect(parsePagination(qs("page=-3&limit=-3"))).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it("clamps limit to 100 and computes skip", () => {
    expect(parsePagination(qs("limit=100000"))).toMatchObject({ limit: 100 });
    expect(parsePagination(qs("page=3&limit=20"))).toEqual({ page: 3, limit: 20, skip: 40 });
    expect(parsePagination(qs("limit=5"), { maxLimit: 10, defaultLimit: 20 }).limit).toBe(5);
    expect(parsePagination(qs(""), { maxLimit: 10, defaultLimit: 20 }).limit).toBe(10);
  });

  it("builds the response meta, including a page past the end", () => {
    expect(paginationMeta(250, { page: 1, limit: 50 })).toEqual({ total: 250, page: 1, limit: 50, totalPages: 5 });
    expect(paginationMeta(251, { page: 9, limit: 50 }).totalPages).toBe(6);
    expect(paginationMeta(0, { page: 1, limit: 50 }).totalPages).toBe(0);
  });

  it("escapes regex characters so search text is plain text", () => {
    const text = "a.b*c+d?(e)[f]{g}|h^i$j\\k";
    expect(new RegExp(escapeRegex(text)).test(text)).toBe(true);
    expect(new RegExp(escapeRegex("(")).test("(")).toBe(true);
    expect(new RegExp(escapeRegex("a.c"), "i").test("abc")).toBe(false);
  });

  it("searchTerm trims, caps the length and drops blanks", () => {
    expect(searchTerm(qs("search=%20%20"))).toBeUndefined();
    expect(searchTerm(qs("q=%20tee%20"), "q")).toBe("tee");
    expect(searchTerm(qs(`search=${"x".repeat(500)}`))).toHaveLength(80);
  });
});

async function seedProducts(n: number, extra: (i: number) => Record<string, unknown> = () => ({})) {
  const docs = Array.from({ length: n }, (_, i) => ({
    name: `Product ${String(i).padStart(3, "0")}`,
    slug: `product-${i}`,
    category: i % 2 ? "tees" : "hoodies",
    price: 100 + i,
    description: "d",
    images: [
      { url: `https://x/${i}-a.jpg`, publicId: `indian-mist/products/${i}-a`, alt: "", isPrimary: true },
      { url: `https://x/${i}-b.jpg`, publicId: `indian-mist/products/${i}-b`, alt: "", isPrimary: false },
    ],
    ...extra(i),
  }));
  await Product.insertMany(docs, { ordered: true });
}

const ids = async (url: string) => (await (await call(products.GET, url)).json()).products.map((p: { name: string }) => p.name) as string[];

describe("admin products list", () => {
  it("pages through 130 products without repeating or skipping one", async () => {
    await seedProducts(130); // all order 0, several created in the same millisecond
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await (await call(products.GET, `/x?page=${page}&limit=50`)).json();
      expect(res).toMatchObject({ total: 130, page, limit: 50, totalPages: 3 });
      seen.push(...res.products.map((p: { name: string }) => p.name));
    }
    expect(seen).toHaveLength(130);
    expect(new Set(seen).size).toBe(130);
  });

  it("returns a lean projection with only the first image", async () => {
    await seedProducts(2);
    const [p] = (await (await call(products.GET, "/x")).json()).products;
    for (const key of ["_id", "name", "slug", "category", "price", "images"]) expect(p).toHaveProperty(key);
    for (const heavy of ["description", "features", "careInstructions", "sizeStock", "materials", "tags"]) expect(p).not.toHaveProperty(heavy);
    expect(p.images).toHaveLength(1);
  });

  it("searches by name (case-insensitive), with a category filter, and survives regex characters", async () => {
    await seedProducts(10, (i) => (i === 3 ? { name: "Forest (Special) Tee" } : {}));
    expect(await ids("/x?search=special")).toEqual(["Forest (Special) Tee"]);
    expect((await call(products.GET, "/x?search=(")).status).toBe(200);
    expect((await call(products.GET, "/x?search=.*")).status).toBe(200);
    expect((await (await call(products.GET, "/x?search=.*")).json()).total).toBe(0);
    const tees = await (await call(products.GET, "/x?category=tees&limit=100")).json();
    expect(tees.total).toBe(5);
    const both = await (await call(products.GET, "/x?category=tees&search=Product 001")).json();
    expect(both.products.map((p: { name: string }) => p.name)).toEqual(["Product 001"]);
  });

  it("bad page/limit values cannot bypass the cap; a page past the end is an empty list", async () => {
    await seedProducts(120);
    for (const bad of ["limit=abc", "limit=0", "limit=-5", "limit=", "limit=100000"]) {
      const res = await (await call(products.GET, `/x?${bad}`)).json();
      expect(res.products.length).toBeLessThanOrEqual(100);
      expect(res.limit).toBeLessThanOrEqual(100);
    }
    const past = await (await call(products.GET, "/x?page=99")).json();
    expect(past).toMatchObject({ products: [], total: 120, page: 99, totalPages: 3 });
  });

  it("is admin only", async () => {
    expect((await call(products.GET, "/x", { role: "user" })).status).toBe(403);
  });

  it("colour groups: distinct and non-empty", async () => {
    await seedProducts(6, (i) => ({ colorGroup: ["", "sage", "sage", "moss", "", "ink"][i] }));
    const body = await (await call(colorGroups.GET, "/x")).json();
    expect(body.colorGroups).toEqual(["ink", "moss", "sage"]);
  });
});

describe("product reorder across pages", () => {
  const pageIds = async (page: number, limit = 50) =>
    (await (await call(products.GET, `/x?page=${page}&limit=${limit}`)).json()).products.map((p: { _id: string }) => String(p._id)) as string[];
  const reorder = (orderedIds: string[], offset: number) =>
    call(productReorder.PUT, "/x", { method: "PUT", json: { orderedIds, offset } });

  it("reorders inside page 2 and renumbers the whole list, even when every order was 0", async () => {
    await seedProducts(120);
    const before = [...(await pageIds(1)), ...(await pageIds(2)), ...(await pageIds(3))];
    expect(await Product.countDocuments({ order: 0 })).toBe(120);

    const page2 = await pageIds(2);
    const moved = [...page2.slice(1), page2[0]]; // first of page 2 goes to the end of page 2
    const res = await reorder(moved, 50);
    expect(res.status).toBe(200);

    const after = [...(await pageIds(1)), ...(await pageIds(2)), ...(await pageIds(3))];
    expect(after).toEqual([...before.slice(0, 50), ...moved, ...before.slice(100)]);
    // Every product now has its own position as its order
    const orders = (await Product.find().select("order").lean()).map((p) => p.order as number).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 120 }, (_, i) => i));
    // And the sort used by the public listing agrees
    const sorted = await Product.find().sort(PRODUCT_SORT).select("_id").lean();
    expect(sorted.map((p) => String(p._id))).toEqual(after);
  });

  it("answers 409 when someone else changed the list meanwhile, and changes nothing", async () => {
    await seedProducts(60);
    const page1 = await pageIds(1, 20);
    // another admin adds a product that sorts into the first page, then...
    await Product.create({ name: "Interloper", slug: "interloper", category: "tees", price: 5, description: "d", images: [{ url: "https://x/i.jpg", publicId: "indian-mist/products/i", alt: "", isPrimary: true }], order: -1 });
    const snapshot = JSON.stringify(await Product.find().sort(PRODUCT_SORT).select("_id order").lean());
    const res = await reorder([...page1].reverse(), 0);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/refresh/i);
    expect(JSON.stringify(await Product.find().sort(PRODUCT_SORT).select("_id order").lean())).toBe(snapshot);
  });

  it("409 for a wrong offset or a deleted product; 400 for bad bodies", async () => {
    await seedProducts(30);
    const page = await pageIds(1, 10);
    expect((await reorder(page, 5)).status).toBe(409);
    await Product.deleteOne({ _id: page[0] });
    expect((await reorder(page, 0)).status).toBe(409);
    for (const json of [{}, { orderedIds: "x" }, { orderedIds: [] }, { orderedIds: ["nope"], offset: 0 }, { orderedIds: [page[1]], offset: -1 }, { orderedIds: [page[1], page[1]], offset: 0 }, { orderedIds: Array(101).fill(String(new mongoose.Types.ObjectId())), offset: 0 }]) {
      const res = await call(productReorder.PUT, "/x", { method: "PUT", json });
      expect(res.status).toBe(400);
      expect(res.status).not.toBe(200);
    }
    expect((await call(productReorder.PUT, "/x", { method: "PUT", json: { orderedIds: [page[1]], offset: 0 }, role: "user" })).status).toBe(403);
  });
});

describe("categories", () => {
  it("lists with the shared pagination and reorders with the same safety check", async () => {
    await Category.insertMany(Array.from({ length: 5 }, (_, i) => ({ name: `Cat ${i}`, slug: `cat-${i}` })));
    const list = await (await call(categories.GET, "/x?limit=100")).json();
    expect(list).toMatchObject({ total: 5, page: 1, limit: 100, totalPages: 1 });
    const idsNow = list.categories.map((c: { _id: string }) => String(c._id)) as string[];

    const reversed = [...idsNow].reverse();
    expect((await call(categoryReorder.PUT, "/x", { method: "PUT", json: { orderedIds: reversed, offset: 0 } })).status).toBe(200);
    const again = (await (await call(categories.GET, "/x?limit=100")).json()).categories.map((c: { _id: string }) => String(c._id));
    expect(again).toEqual(reversed);

    expect((await call(categoryReorder.PUT, "/x", { method: "PUT", json: { orderedIds: reversed.slice(1), offset: 0 } })).status).toBe(409); // not exactly the first page-worth
    await Category.deleteOne({ _id: reversed[0] });
    expect((await call(categoryReorder.PUT, "/x", { method: "PUT", json: { orderedIds: [...reversed].reverse(), offset: 0 } })).status).toBe(409);
  });
});

describe("collections", () => {
  it("lists a count, not the products, and the single collection brings light populated products", async () => {
    await seedProducts(3);
    const prods = await Product.find().select("_id").lean();
    const c = await Collection.create({ name: "Mix", slug: "mix", products: prods.map((p) => p._id) });
    await Collection.create({ name: "Empty", slug: "empty" });

    const list = await (await call(collections.GET, "/x")).json();
    expect(list).toMatchObject({ total: 2, page: 1, limit: 50, totalPages: 1 });
    const mix = list.collections.find((x: { slug: string }) => x.slug === "mix");
    expect(mix.productCount).toBe(3);
    expect(mix).not.toHaveProperty("products");
    expect(list.collections.find((x: { slug: string }) => x.slug === "empty").productCount).toBe(0);

    const one = (await (await call(collectionById.GET, "/x", { id: String(c._id) })).json()).collection;
    expect(one.products).toHaveLength(3);
    expect(Object.keys(one.products[0]).sort()).toEqual(["_id", "category", "images", "name", "slug"]);
    expect(one.products[0].images).toHaveLength(1);
  });

  it("pages past 50 collections", async () => {
    await Collection.insertMany(Array.from({ length: 55 }, (_, i) => ({ name: `C${i}`, slug: `c-${i}` })));
    const p1 = await (await call(collections.GET, "/x?page=1")).json();
    const p2 = await (await call(collections.GET, "/x?page=2")).json();
    expect(p1.collections).toHaveLength(50);
    expect(p2.collections).toHaveLength(5);
    expect(new Set([...p1.collections, ...p2.collections].map((x: { _id: string }) => x._id)).size).toBe(55);
  });
});

describe("blogs and orders", () => {
  it("blogs: shared pagination and a page past the end", async () => {
    await Blog.insertMany(Array.from({ length: 3 }, (_, i) => ({ title: `T${i}`, slug: `t-${i}`, excerpt: "e", content: "c", category: "x", author: "a", isPublished: true, coverImage: { url: "https://x/c.jpg", publicId: "indian-mist/blogs/c", alt: "" } })));
    const res = await (await call(blogs.GET, "/x?limit=2")).json();
    expect(res).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(res.blogs).toHaveLength(2);
    expect(res.blogs[0]).not.toHaveProperty("content");
    expect((await (await call(blogs.GET, "/x?page=7&limit=2")).json()).blogs).toEqual([]);
  });

  async function seedOrders() {
    const base = { userId: new mongoose.Types.ObjectId(), customerName: "A", email: "a@b.c", phone: "9999999999", items: [], subtotal: 100, totalAmount: 100, shippingAddress: { street: "s", city: "c", state: "s", zipCode: "123456", country: "India" }, paymentStatus: "PAID" };
    const statuses = ["PROCESSING", "PROCESSING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    for (const [i, status] of statuses.entries()) {
      await Order.collection.insertOne({ ...base, status, razorpayOrderId: `o${i}`, createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() });
    }
    await Order.collection.insertOne({ ...base, status: "PENDING", paymentStatus: "UNPAID", razorpayOrderId: "unpaid", createdAt: new Date(), updatedAt: new Date() });
  }

  it("orders: pages, filters by tab and reports per-tab totals", async () => {
    await seedOrders();
    const all = await (await call(orders.GET, "/x?status=ALL&limit=4")).json();
    expect(all).toMatchObject({ total: 6, page: 1, limit: 4, totalPages: 2 });
    expect(all.orders).toHaveLength(4);
    expect(all.statusCounts).toMatchObject({ ALL: 6, PROCESSING: 3, SHIPPED: 1, DELIVERED: 1, CANCELLED: 1 });

    const processing = await (await call(orders.GET, "/x?status=PROCESSING")).json();
    expect(processing.total).toBe(3);
    expect(processing.statusCounts.ALL).toBe(6); // tab counts do not change with the selected tab

    const p2 = await (await call(orders.GET, "/x?status=ALL&limit=4&page=2")).json();
    expect(p2.orders).toHaveLength(2);
    const allIds = [...all.orders, ...p2.orders].map((o: { _id: string }) => o._id);
    expect(new Set(allIds).size).toBe(6);
  });
});

import { togglePicked, pickedFromCollection } from "@/lib/product-picker";

describe("product picker selection", () => {
  const prod = (n: number) => ({ _id: `p${n}`, name: `Product ${n}`, category: "tees", images: [{ url: `https://x/${n}.jpg` }] });

  it("keeps selections made on different pages and searches, with what is needed to show them", () => {
    let selected = togglePicked([], prod(1)); // page 1
    selected = togglePicked(selected, prod(41)); // page 3 / another search
    selected = togglePicked(selected, prod(7));
    expect(selected.map((p) => p._id)).toEqual(["p1", "p41", "p7"]);
    expect(selected[1]).toEqual({ _id: "p41", name: "Product 41", category: "tees", image: "https://x/41.jpg" });
    selected = togglePicked(selected, prod(41)); // untick
    expect(selected.map((p) => p._id)).toEqual(["p1", "p7"]);
  });

  it("handles a product without photos or category", () => {
    expect(togglePicked([], { _id: "a", name: "A" })).toEqual([{ _id: "a", name: "A", category: "", image: undefined }]);
  });

  it("starts from the populated products of an existing collection", () => {
    const start = pickedFromCollection([prod(2), prod(3)]);
    expect(start.map((p) => p.name)).toEqual(["Product 2", "Product 3"]);
    expect(togglePicked(start, prod(9)).map((p) => p._id)).toEqual(["p2", "p3", "p9"]);
  });
});

import { describe, expect, it, vi } from "vitest";
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
import { getProductListing, parseListingQuery, LISTING_PAGE_SIZE, LISTING_MAX_LIMIT } from "@/lib/product-listing";
import { getCategoryCounts, getCategoryNames } from "@/lib/storefront-data";
import { humaniseSlug, categoryLabel } from "@/lib/category-labels";
import { getProductsByIds, getCollectionBatch } from "@/lib/collection-products";
import { getPublishedBlogs, getPublishedBlogCategories } from "@/lib/blogs-list";
import { adminPageTitle } from "@/components/admin/AdminTopBar";
import * as productsApi from "@/app/api/products/route";
import * as collectionApi from "@/app/api/collections/[slug]/products/route";
import * as blogsApi from "@/app/api/blogs/route";
import * as productById from "@/app/api/admin/products/[id]/route";

setupTestDb();

const qs = (s: string) => new URLSearchParams(s);
let n = 0;
async function product(over: Record<string, unknown> = {}) {
  n++;
  return Product.create({
    name: `Item ${String(n).padStart(3, "0")}`, slug: `item-${n}`, description: "d", category: "tees", price: 100,
    images: [{ url: `https://x/${n}.jpg`, publicId: `indian-mist/products/${n}`, alt: "", isPrimary: true }], ...over,
  });
}
async function seedCatalogue() {
  await Category.create([{ name: "T-Shirts", slug: "tees" }, { name: "Caps & Hats", slug: "caps" }, { name: "Hidden Gear", slug: "hidden", isHidden: true }]);
  for (let i = 0; i < 6; i++) await product({ category: "tees", badge: i < 2 ? "Sale" : "" });
  for (let i = 0; i < 3; i++) await product({ category: "caps", badge: i === 0 ? "New" : "Sale" });
  await product({ category: "hidden" });
}

describe("grouped category counts", () => {
  it("counts products per category with one grouped query and no joins", async () => {
    await seedCatalogue();
    expect(await getCategoryCounts()).toEqual({ tees: 6, caps: 3, hidden: 1 });
    // an empty category simply is not in the answer (the page shows 0)
    await Category.create({ name: "Empty", slug: "empty" });
    expect((await getCategoryCounts()).empty).toBeUndefined();
  });
  it("real names for every category, hidden ones too; unknown slugs get a readable fallback", async () => {
    await seedCatalogue();
    const names = await getCategoryNames();
    expect(names).toMatchObject({ tees: "T-Shirts", caps: "Caps & Hats", hidden: "Hidden Gear" });
    expect(categoryLabel(names, "tees")).toBe("T-Shirts");
    expect(categoryLabel(names, "old-boots")).toBe("Old Boots");
    expect(humaniseSlug("rain_jackets  v2")).toBe("Rain Jackets V2");
  });
});

describe("listing: parameters and bounds", () => {
  it("defaults, and the public limits (12 by default, at most 60)", () => {
    expect(parseListingQuery(qs(""))).toMatchObject({ page: 1, limit: 12, sort: "featured", categories: [], badges: [], q: "" });
    expect(parseListingQuery(qs("limit=1000")).limit).toBe(LISTING_MAX_LIMIT);
    expect(LISTING_MAX_LIMIT).toBe(60);
    for (const bad of ["abc", "0", "-4", "", "1.5", "NaN"]) {
      const q = parseListingQuery(qs(`page=${bad}&limit=${bad}`));
      expect(q.page).toBe(1);
      expect(q.limit).toBe(LISTING_PAGE_SIZE);
    }
    expect(parseListingQuery(qs("page=999999")).page).toBe(1000);
  });
  it("unknown sort falls back to featured; filters are split, trimmed and bounded; search is capped", () => {
    expect(parseListingQuery(qs("sort=hax")).sort).toBe("featured");
    expect(parseListingQuery(qs("category=a, b ,,c&badge=Sale")).categories).toEqual(["a", "b", "c"]);
    expect(parseListingQuery(qs(`category=${"x,".repeat(200)}`)).categories.length).toBeLessThanOrEqual(50);
    expect(parseListingQuery(qs(`q=${"y".repeat(300)}`)).q).toHaveLength(80);
  });
  it("a page past the end is empty, with the true total", async () => {
    await seedCatalogue();
    const res = await getProductListing(parseListingQuery(qs("page=50")));
    expect(res.products).toEqual([]);
    expect(res.total).toBe(10);
    expect(res.hasMore).toBe(false);
  });
});

describe("listing: facets", () => {
  it("shows real category names, never slugs", async () => {
    await seedCatalogue();
    const { facets, products } = await getProductListing(parseListingQuery(qs("")));
    expect(facets.categories.map((c) => c.name).sort()).toEqual(["Caps & Hats", "Hidden Gear", "T-Shirts"]);
    expect(facets.categories.find((c) => c.value === "tees")).toMatchObject({ name: "T-Shirts", count: 6 });
    expect(products.every((p) => p.categoryLabel !== p.category || p.category === "")).toBe(true);
    expect(products.find((p) => p.category === "tees")!.categoryLabel).toBe("T-Shirts");
  });

  it("choosing a category does not hide the other categories, and their counts stay", async () => {
    await seedCatalogue();
    const all = await getProductListing(parseListingQuery(qs("")));
    const tees = await getProductListing(parseListingQuery(qs("category=tees")));
    expect(tees.total).toBe(6);
    expect(tees.products.every((p) => p.category === "tees")).toBe(true);
    expect(tees.facets.categories).toEqual(all.facets.categories); // unchanged by its own selection
  });

  it("category counts follow the OTHER filters (badge, search) but not their own", async () => {
    await seedCatalogue();
    const sale = await getProductListing(parseListingQuery(qs("badge=Sale")));
    expect(sale.facets.categories.find((c) => c.value === "tees")!.count).toBe(2);
    expect(sale.facets.categories.find((c) => c.value === "caps")!.count).toBe(2);
    expect(sale.facets.categories.find((c) => c.value === "hidden")).toBeUndefined();
    // badge facet: with tees chosen it counts tees only, but is NOT narrowed by the badge itself
    const teesSale = await getProductListing(parseListingQuery(qs("category=tees&badge=Sale")));
    expect(teesSale.total).toBe(2);
    expect(teesSale.facets.badges.map((b) => [b.value, b.count]).sort()).toEqual([["Sale", 2]]);
    const teesOnly = await getProductListing(parseListingQuery(qs("category=tees")));
    expect(teesOnly.facets.badges).toEqual([{ name: "Sale", value: "Sale", count: 2 }]);
    const search = await getProductListing(parseListingQuery(qs("q=item 00")));
    expect(search.facets.categories.reduce((s, c) => s + c.count, 0)).toBe(search.total + 0); // single filter: counts add up to the matches
  });

  it("a ticked filter stays visible with 0 when nothing matches it", async () => {
    await seedCatalogue();
    const res = await getProductListing(parseListingQuery(qs("category=caps&badge=Sold Out")));
    expect(res.total).toBe(0);
    expect(res.facets.badges.find((b) => b.value === "Sold Out")).toEqual({ name: "Sold Out", value: "Sold Out", count: 0 });
    expect(res.facets.badges.map((b) => b.value).sort()).toEqual(["New", "Sale", "Sold Out"]); // the others stay, as caps has New and Sale
    expect(res.facets.categories.find((c) => c.value === "caps")).toBeTruthy();
  });

  it("search text is plain text, not a pattern", async () => {
    await seedCatalogue();
    await product({ name: "Wool (Heavy) Beanie", category: "caps" });
    expect((await getProductListing(parseListingQuery(qs("q=(heavy")))).total).toBe(1);
    expect((await getProductListing(parseListingQuery(qs("q=.*")))).total).toBe(0);
  });
});

describe("listing: paging without repeats or gaps", () => {
  it("equal prices and dates still page cleanly in every sort", async () => {
    for (let i = 0; i < 30; i++) await product({ price: 250, category: "tees", name: i % 2 ? "Same Name" : "Same Name" });
    for (const sort of ["featured", "newest", "price-low", "price-high", "name-asc", "name-desc"]) {
      const seen: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await getProductListing(parseListingQuery(qs(`sort=${sort}&page=${page}&limit=12`)));
        expect(res.hasMore).toBe(page < 3);
        seen.push(...res.products.map((p) => p.id));
      }
      expect(seen, sort).toHaveLength(30);
      expect(new Set(seen).size, sort).toBe(30);
    }
  });
});

describe("listing parity: the page and /api/products give the same answer", () => {
  it("same products, labels, counts and order for the same filters", async () => {
    await seedCatalogue();
    for (const query of ["", "category=tees", "category=caps&sort=price-high", "sort=name-asc", "category=tees,caps&badge=Sale", "q=item"]) {
      // what the page does (see app/products/page.tsx): first batch of 12 with the page's filters
      const page = await getProductListing({ ...parseListingQuery(qs(query)), page: 1, limit: LISTING_PAGE_SIZE });
      const res = await productsApi.GET(new NextRequest(`http://localhost/api/products?${query}&page=1&limit=12`));
      expect(res.status).toBe(200);
      expect(await res.json(), query).toEqual(JSON.parse(JSON.stringify(page)));
    }
  });
  it("the API keeps the public limit", async () => {
    await seedCatalogue();
    for (let i = 0; i < 70; i++) await product({ category: "tees" });
    const body = await (await productsApi.GET(new NextRequest("http://localhost/api/products?limit=5000"))).json();
    expect(body.products).toHaveLength(60);
    expect(body.hasMore).toBe(true);
  });
});

describe("collections: bounded previews and batches", () => {
  async function bigCollection(size: number) {
    const ids: mongoose.Types.ObjectId[] = [];
    for (let i = 0; i < size; i++) ids.push((await product({ category: "tees" }))._id as mongoose.Types.ObjectId);
    return Collection.create({ name: "Big", slug: "big", products: ids });
  }

  it("getProductsByIds: one query, in the order given, skipping products that are gone", async () => {
    const a = await product(); const b = await product(); const c = await product();
    await b.deleteOne();
    const find = vi.spyOn(Product, "find");
    const res = await getProductsByIds([c._id, b._id, a._id]);
    expect(res.map((p) => p.name)).toEqual([c.name, a.name]);
    expect(find).toHaveBeenCalledTimes(1);
    expect(await getProductsByIds([])).toEqual([]);
    find.mockRestore();
  });

  it("a collection page loads 24 at a time, covering every product exactly once", async () => {
    const col = await bigCollection(60);
    const all: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await getCollectionBatch(col.products, page, 24);
      expect(batch.total).toBe(60);
      expect(batch.hasMore).toBe(page < 3);
      expect(batch.cards.length).toBe(page < 3 ? 24 : 12);
      all.push(...batch.cards.map((c) => c.productId!));
    }
    expect(new Set(all).size).toBe(60);
    expect(all).toEqual(col.products.map(String)); // the order the admin chose
    expect((await getCollectionBatch(col.products, 9, 24)).cards).toEqual([]);
    expect((await getCollectionBatch(col.products, 1, 5000)).cards.length).toBe(60); // bounded by the max (60)
  });

  it("the API returns the next batch, 404s an unknown or inactive collection, and bounds its inputs", async () => {
    const col = await bigCollection(30);
    const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
    const res = await collectionApi.GET(new NextRequest("http://localhost/api/collections/big/products?page=2&limit=24"), ctx("big"));
    const body = await res.json();
    expect(body.cards).toHaveLength(6);
    expect(body.hasMore).toBe(false);
    const weird = await collectionApi.GET(new NextRequest("http://localhost/api/collections/big/products?page=abc&limit=-3"), ctx("big"));
    expect((await weird.json()).cards).toHaveLength(24);
    expect((await collectionApi.GET(new NextRequest("http://localhost/api/collections/nope/products"), ctx("nope"))).status).toBe(404);
    await Collection.updateOne({ _id: col._id }, { isActive: false });
    expect((await collectionApi.GET(new NextRequest("http://localhost/api/collections/big/products"), ctx("big"))).status).toBe(404);
  });

  it("deleting a product removes it from collections", async () => {
    const col = await bigCollection(3);
    const doomed = col.products[1];
    const res = await productById.DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE", headers: { "x-user-role": "admin", "x-user-id": "u", "x-user-email": "a@b.c" } }),
      { params: Promise.resolve({ id: String(doomed) }) },
    );
    expect(res.status).toBe(200);
    expect((await Collection.findById(col._id))!.products.map(String)).not.toContain(String(doomed));
    expect((await Collection.findById(col._id))!.products).toHaveLength(2);
  });
});

describe("blogs: 12 per batch", () => {
  async function posts(count: number, extra: (i: number) => Record<string, unknown> = () => ({})) {
    for (let i = 0; i < count; i++) {
      await Blog.create({ title: `Post ${i}`, slug: `post-${i}`, excerpt: "e", content: "FULL TEXT", category: i % 3 === 0 ? "Trail" : "Gear", author: "a", isPublished: true, publishedAt: new Date(2026, 0, 1 + (i % 4)), ...extra(i) });
    }
  }
  it("pages through 30 posts without repeats, newest first, without the full text", async () => {
    await posts(30);
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await getPublishedBlogs({ page });
      expect(res.total).toBe(30);
      expect(res.hasMore).toBe(page < 3);
      expect(res.blogs.length).toBe(page < 3 ? 12 : 6);
      expect(res.blogs.every((b) => !("content" in b) || b.content === undefined)).toBe(true);
      seen.push(...res.blogs.map((b) => b._id));
    }
    expect(new Set(seen).size).toBe(30);
  });
  it("filters by category, only shows published posts, and lists the categories", async () => {
    await posts(10);
    await Blog.create({ title: "Draft", slug: "draft", excerpt: "e", content: "c", category: "Secret", author: "a", isPublished: false });
    expect((await getPublishedBlogs({ category: "Trail" })).total).toBe(4);
    expect(await getPublishedBlogCategories()).toEqual(["Gear", "Trail"]);
  });
  it("the API bounds its inputs", async () => {
    await posts(20);
    const body = await (await blogsApi.GET(new NextRequest("http://localhost/api/blogs?page=zz&limit=9999"))).json();
    expect(body.blogs.length).toBe(20);
    const small = await (await blogsApi.GET(new NextRequest("http://localhost/api/blogs?limit=5&category=Trail"))).json();
    expect(small.blogs.length).toBe(5);
    expect(small.hasMore).toBe(true);
  });
});

describe("indexes serve the queries that exist", () => {
  const stage = (plan: unknown): string => JSON.stringify(plan);
  const usesIndex = async (q: { explain: (v: string) => Promise<unknown> }, name: string) => {
    const plan = stage(await q.explain("queryPlanner"));
    expect(plan).toContain("IXSCAN");
    expect(plan).toContain(name);
    expect(plan).not.toContain("COLLSCAN");
  };

  it("orders: admin tabs, the 'all' tab and promo-code usage", async () => {
    await Order.init();
    await Order.collection.insertMany(Array.from({ length: 20 }, (_, i) => ({ userId: new mongoose.Types.ObjectId(), paymentStatus: i % 2 ? "PAID" : "UNPAID", status: "PROCESSING", promoCode: i % 3 ? "A" : "B", createdAt: new Date(i) })));
    await usesIndex(Order.find({ paymentStatus: "PAID", status: "SHIPPED" }).sort({ createdAt: -1 }).hint({ paymentStatus: 1, status: 1, createdAt: -1 }) as never, "paymentStatus_1_status_1_createdAt_-1");
    await usesIndex(Order.find({ paymentStatus: "PAID" }).sort({ createdAt: -1 }) as never, "paymentStatus_1_createdAt_-1");
    await usesIndex(Order.find({ promoCode: "A", paymentStatus: "PAID" }) as never, "promoCode_1_paymentStatus_1");
  });
  it("blogs: published newest first, with and without a category", async () => {
    await Blog.init();
    await usesIndex(Blog.find({ isPublished: true }).sort({ publishedAt: -1, _id: 1 }) as never, "isPublished_1_publishedAt_-1");
    await usesIndex(Blog.find({ isPublished: true, category: "Trail" }).sort({ publishedAt: -1, _id: 1 }) as never, "isPublished_1_category_1_publishedAt_-1");
  });
  it("collections: active ones in display order; products: the admin sort", async () => {
    await Collection.init(); await Product.init();
    await usesIndex(Collection.find({ isActive: true }).sort({ order: 1, createdAt: 1 }) as never, "isActive_1_order_1");
    await usesIndex(Product.find({}).sort({ order: 1, createdAt: -1, _id: 1 }) as never, "order_1_createdAt_-1__id_1");
  });
});

describe("admin page titles", () => {
  it("every admin page has its own title", () => {
    const cases: [string, string][] = [
      ["/admin", "Dashboard"], ["/admin/products", "Products"], ["/admin/products/new", "Add Product"], ["/admin/products/abc/edit", "Edit Product"],
      ["/admin/categories", "Categories"], ["/admin/categories/new", "Add Category"], ["/admin/categories/abc", "Edit Category"],
      ["/admin/collections", "Collections"], ["/admin/collections/new", "Add Collection"], ["/admin/collections/abc/edit", "Edit Collection"],
      ["/admin/blogs", "Blog Posts"], ["/admin/blogs/new", "New Blog Post"], ["/admin/blogs/abc", "Edit Blog Post"],
      ["/admin/orders", "Orders"], ["/admin/pricing", "Pricing & Promos"], ["/admin/homepage", "Layout & Text"], ["/admin/contact", "Contact Page"],
      ["/admin/legal/privacy-policy", "Privacy Policy"], ["/admin/legal/terms-and-conditions", "Terms & Conditions"],
      ["/admin/announcements", "Announcements"], ["/admin/carousel", "Carousel"], ["/admin/about", "About Page"], ["/admin/settings", "Site Settings"],
    ];
    for (const [path, title] of cases) expect(adminPageTitle(path), path).toBe(title);
  });
});

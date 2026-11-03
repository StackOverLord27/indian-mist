import { test, expect } from "@playwright/test";
import { db, oid, closeDb } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// The public listing pages against a seeded local database: real names on cards and filters,
// facets that keep the other categories, and "Load more" on collections and the blog.

let slugs: { collection: string };

test.beforeAll(async ({ browser }) => {
  const d = await db();
  await Promise.all(["products", "categories", "collections", "blogs", "orders", "stockreservations"].map((c) => d.collection(c).deleteMany({})));
  const now = new Date();
  await d.collection("categories").insertMany([
    { name: "T-Shirts", slug: "tees", order: 0, isFeatured: false, isHidden: false, createdAt: now, updatedAt: now },
    { name: "Caps & Hats", slug: "caps", order: 1, isFeatured: false, isHidden: false, createdAt: now, updatedAt: now },
  ]);
  const docs = Array.from({ length: 40 }, (_, i) => ({
    name: `Listing Item ${String(i).padStart(2, "0")}`, slug: `listing-item-${i}`, description: "d", category: i % 2 ? "caps" : "tees", price: 300 + i,
    images: [{ url: "https://placehold.co/400x500/png", publicId: `p${i}`, alt: "", isPrimary: true }], sizes: [], colors: [], features: [], tags: [], materials: [],
    trackInventory: false, stockQuantity: 0, order: 0, isFeatured: i < 30, badge: i % 5 === 0 ? "Sale" : "", createdAt: new Date(now.getTime() - i * 1000), updatedAt: now,
  }));
  const res = await d.collection("products").insertMany(docs);
  const ids = Object.values(res.insertedIds);
  await d.collection("collections").insertMany([
    { name: "Big Collection", slug: "big-collection", description: "", products: ids.slice(0, 30), isActive: true, order: 0, createdAt: now, updatedAt: now },
  ]);
  await d.collection("blogs").insertMany(Array.from({ length: 15 }, (_, i) => ({
    title: `Journal Post ${String(i).padStart(2, "0")}`, slug: `journal-post-${i}`, excerpt: "An excerpt.", content: "<p>x</p>", category: i % 2 ? "Gear" : "Trail", author: "Indian Mist", isPublished: true, readTime: 3,
    coverImage: { url: "https://placehold.co/600x400/png", publicId: `b${i}`, alt: "" }, publishedAt: new Date(2026, 0, 1 + i), createdAt: new Date(2026, 0, 1 + i), updatedAt: now,
  })));
  void oid;
  slugs = { collection: "big-collection" };

  // The pages are cached (ISR); the admin's own save is what refreshes them. Do exactly that
  // (add and remove an announcement through the admin API) instead of waiting for the timer.
  const admin = await newContext(browser, "admin");
  const created = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).announcement._id;
  await admin.request.delete(`/api/admin/announcements/${id}`);
  await admin.close();
});
test.afterAll(() => closeDb());

test("/products: real category names on the very first render, and filters keep the other categories", async ({ page, request }) => {
  // the server-rendered HTML (before any script runs) already has the names, not the slugs
  const html = await (await request.get("/products")).text();
  expect(html).toContain("T-Shirts");
  expect(html).toContain("Caps &amp; Hats");
  expect(html).not.toMatch(/>\s*tees\s*</);

  await page.goto("/products");
  await expect(page.getByText("40 products")).toBeVisible();
  await expect(page.getByText("T-Shirts").first()).toBeVisible(); // on the cards
  await page.getByRole("button", { name: /filter/i }).click();
  await expect(page.getByRole("checkbox", { name: "T-Shirts" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Caps & Hats" })).toBeVisible();

  // choosing T-Shirts does not hide Caps & Hats
  await page.getByRole("checkbox", { name: "T-Shirts" }).click();
  await expect(page.getByText("20 products found")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Caps & Hats" })).toBeVisible();
  await expect(page.getByText("(20)").first()).toBeVisible();
});

test("/products: infinite scroll keeps loading until the end, with no repeats", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator("h3").first()).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(500);
  }
  await expect.poll(() => page.locator("h3", { hasText: "Listing Item" }).count(), { timeout: 20_000 }).toBe(40);
  const titles = await page.locator("h3", { hasText: "Listing Item" }).allTextContents();
  expect(new Set(titles).size).toBe(40);
});

test("home: featured products are bounded (24) and category counts are right", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("20 products").first()).toBeVisible(); // 20 tees, 20 caps
  await expect(page.getByText("Featured products")).toBeVisible();
  const featured = page.locator("section", { has: page.getByText("Featured products") });
  await featured.scrollIntoViewIfNeeded();
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(500); } // scrolling to the end loads each batch of 8
  const featuredCount = await featured.locator("h3").count();
  expect(featuredCount).toBeLessThanOrEqual(24);
  await expect(featured.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/products");
  expect(featuredCount).toBe(24); // 30 are featured; the page stops at 24
});

test("collections: a short preview with a link, and the collection page loads the rest on request", async ({ page }) => {
  await page.goto("/collections");
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Big Collection" }) });
  await expect(section.locator("h3")).toHaveCount(8);
  await section.getByRole("link", { name: /View all in Big Collection/ }).click();

  await expect(page).toHaveURL(new RegExp(`/collections/${slugs.collection}`));
  await expect(page.locator("h3", { hasText: "Listing Item" })).toHaveCount(24);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.locator("h3", { hasText: "Listing Item" })).toHaveCount(30);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
});

test("blogs: 12 posts, then Load more, and the category filter fetches its own posts", async ({ page }) => {
  await page.goto("/blogs");
  const cards = page.locator("a[href^='/blogs/']", { hasText: "Journal Post" });
  await expect(cards).toHaveCount(12);
  await page.getByRole("button", { name: "Load more posts" }).click();
  await expect(cards).toHaveCount(15);
  await expect(page.getByRole("button", { name: "Load more posts" })).toHaveCount(0);

  await page.getByRole("link", { name: "Gear", exact: true }).click();
  await expect(cards).toHaveCount(7); // 7 of the 15 are in "Gear"
  await page.getByRole("link", { name: "All Posts" }).click();
  await expect(cards).toHaveCount(12);
});

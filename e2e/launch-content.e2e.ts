import { test, expect } from "@playwright/test";
import { db, closeDb, oid } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// Launch content: the owner can remove every placeholder-able section from the admin, the public
// pages then show nothing in its place, and the search-engine plumbing is in place.

let productSlug = "";

test.beforeAll(async ({ browser }) => {
  const d = await db();
  await Promise.all(["products", "categories", "sitesettings", "settings", "collections", "blogs"].map((c) => d.collection(c).deleteMany({})));
  const now = new Date();
  const p = await d.collection("products").insertOne({
    name: "Launch Tee", slug: "launch-tee", description: "A tee for the launch test.", category: "tees", price: 749,
    images: [{ url: "https://placehold.co/600x800/png", publicId: "l1", alt: "", isPrimary: true }], sizes: [], colors: [], features: [], tags: [], materials: [],
    trackInventory: true, stockQuantity: 0, badge: "Sold Out", order: 0, createdAt: now, updatedAt: now,
  });
  void p; void oid;
  productSlug = "launch-tee";
  await d.collection("sitesettings").insertOne({
    pricingSettings: { shippingCost: 99, freeShippingThreshold: 1499, promoCodes: [] },
    trustStripSettings: { items: [{ icon: "Leaf", title: "Handmade", subtitle: "In small batches" }, { icon: "Award", title: "Local makers", subtitle: "Pune" }] },
    ecoCommitmentSettings: { subtitle: "Numbers", titleLine1: "What we did ", titleLine2: "so far.", items: [{ icon: "TreePine", number: "42", label: "Things done", description: "Typed by the owner" }] },
    heroSettings: { titleLine1: "Owner headline", ecoBadge: { text: "BADGE", subtext: "owner badge", isVisible: true } },
    brandStorySettings: { titleLine1: "Owner story", tags: "Tag One, Tag Two" },
    createdAt: now, updatedAt: now,
  });
  // Refresh the cached pages the way an admin save does
  const admin = await newContext(browser, "admin");
  const res = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  await admin.request.delete(`/api/admin/announcements/${(await res.json()).announcement._id}`);
  await admin.close();
});
test.afterAll(() => closeDb());

test("the owner can remove every trust, eco and tag item, and the home page then shows none of it", async ({ browser, page }) => {
  await page.goto("/");
  await expect(page.getByText("Handmade")).toBeVisible();
  // exactly the typed items: nothing about shipping is added from the pricing setting
  await expect(page.getByText("Local makers")).toBeVisible();
  await expect(page.getByText(/free shipping|On orders above/i)).toHaveCount(0);
  await expect(page.getByText("Things done")).toBeVisible();
  await expect(page.getByText("Tag One")).toBeVisible();
  await expect(page.getByText("BADGE", { exact: true })).toBeVisible();

  const admin = await newContext(browser, "admin");
  const a = await admin.newPage();
  await a.goto("/admin/homepage");
  await expect(a.getByRole("button", { name: "Remove" }).first()).toBeVisible({ timeout: 20_000 });
  // remove every item in both lists (nothing is put back in their place)
  while (await a.getByRole("button", { name: "Remove" }).count()) await a.getByRole("button", { name: "Remove" }).first().click();
  await expect(a.getByText("+ Add Trust Strip Item")).toBeVisible();
  // clear the tags and the badge
  await a.getByPlaceholder("e.g. Organic cotton, Natural dyes").fill("");
  await a.getByPlaceholder("e.g. 100%").fill("");
  await a.getByRole("button", { name: "Save Settings" }).click();
  await expect(a.getByText("Settings updated").first()).toBeVisible({ timeout: 20_000 });

  const d = await db();
  const saved = await d.collection("sitesettings").findOne({});
  expect(saved!.trustStripSettings.items).toEqual([]);
  expect(saved!.ecoCommitmentSettings.items).toEqual([]);
  expect(saved!.brandStorySettings.tags).toBe("");
  expect(saved!.heroSettings.ecoBadge.text).toBe("");

  // reloading the editor keeps them empty (nothing falls back to example content)
  await a.reload();
  await expect(a.getByText("+ Add Trust Strip Item")).toBeVisible({ timeout: 20_000 });
  await expect(a.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await admin.close();

  await page.goto("/");
  await expect(page.getByText("Handmade")).toHaveCount(0);
  await expect(page.getByText(/free shipping|Local makers/i)).toHaveCount(0); // no strip at all
  await expect(page.getByText("Things done")).toHaveCount(0);
  await expect(page.getByText("Tag One")).toHaveCount(0);
  await expect(page.getByText("BADGE", { exact: true })).toHaveCount(0);
  await expect(page.locator("h1")).toContainText("Owner headline");
});

test("search plumbing: sitemap, robots, canonical, Open Graph, structured data, noindex", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/products/${productSlug}`);
  expect(sitemap).not.toMatch(/\/(admin|api|cart|checkout)/);
  const robotsTxt = await (await request.get("/robots.txt")).text();
  expect(robotsTxt).toMatch(/Disallow: \/admin/);
  expect(robotsTxt).toMatch(/Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/);

  await page.goto(`/products/${productSlug}`);
  await expect(page).toHaveTitle("Launch Tee | Indian Mist");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\/launch-tee$/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Launch Tee");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /placehold\.co/);
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "{}");
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers).toMatchObject({ priceCurrency: "INR", price: "749.00", availability: "https://schema.org/OutOfStock" }); // Sold Out
  expect(ld.image).toEqual(["https://placehold.co/600x800/png"]);

  for (const path of ["/cart", "/checkout", "/profile", "/signin", "/signup", "/forgot-password", "/wishlist"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  }
  const header = (await request.get("/api/settings")).headers()["x-robots-tag"];
  expect(header).toContain("noindex");
});

test("refund and shipping policy pages: hidden until the owner saves text in the admin, then linked everywhere", async ({ browser, page, request }) => {
  const d = await db();
  await d.collection("legalpages").deleteMany({});
  const admin = await newContext(browser, "admin");
  const a = await admin.newPage();
  // a harmless save refreshes the cached footer (as any admin change does)
  await admin.request.put("/api/admin/legal/privacy-policy", { data: { title: "Privacy Policy", content: "<p>Privacy text.</p>" } });

  expect((await request.get("/refund-policy")).status()).toBe(404);
  expect((await request.get("/shipping-policy")).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Refund|Shipping & Delivery/i })).toHaveCount(0);

  await a.goto("/admin/legal/refund-policy");
  await expect(a.getByText("This page is not on the site yet")).toBeVisible({ timeout: 20_000 });
  await a.locator(".ProseMirror").click();
  await a.keyboard.type("Returns accepted within seven days of delivery.");
  await expect(a.getByText("This page is live")).toBeVisible();
  await a.getByRole("button", { name: "Save", exact: true }).click();
  await expect(a.getByText("Page updated").first()).toBeVisible({ timeout: 20_000 });

  await expect.poll(async () => (await request.get("/refund-policy")).status(), { timeout: 20_000 }).toBe(200);
  await page.goto("/refund-policy");
  await expect(page.getByText("Returns accepted within seven days of delivery.")).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Refund & Cancellation Policy" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: /Shipping & Delivery/ })).toHaveCount(0);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/refund-policy");
  expect((await request.get("/shipping-policy")).status()).toBe(404);

  // sidebar entries exist for both
  await a.goto("/admin");
  await expect(a.getByRole("link", { name: "Refund Policy" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Shipping Policy" })).toBeVisible();
  await admin.close();
});

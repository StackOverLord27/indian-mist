import { test, expect } from "@playwright/test";
import { db, closeDb, oid, resetShop } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// Product page: larger Highlights, the admin's second list ("Ideal for" / any heading), three tabs
// spread across the whole width that open their content below, and a modest gap above them.

let slug = "";
let plainSlug = "";

test.beforeAll(async ({ browser }) => {
  const shop = await resetShop();
  slug = shop.sized.slug;
  plainSlug = shop.plain.slug;
  const d = await db();
  await d.collection("products").updateOne({ _id: oid(shop.sized.id) }, { $set: {
    tags: ["Bio-Washed", "100% Cotton"], idealForHeading: "Wear it on", idealFor: ["Treks", "Birdwatching", "Road trips"],
    description: "A soft tee made for long days outside.", features: ["Hand-printed", "Pre-washed"],
    materials: ["100% organic cotton"], careInstructions: [{ text: "Machine wash cold", icon: "droplets" }],
    shippingInfo: { standard: "7-8 business days", express: "" },
  } });
  await d.collection("products").updateOne({ _id: oid(shop.plain.id) }, { $set: { tags: ["Plain tag"], idealFor: [], idealForHeading: "" } });
  // pages are cached: refresh them the way an admin save does
  const admin = await newContext(browser, "admin");
  const created = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  await admin.request.delete(`/api/admin/announcements/${(await created.json()).announcement._id}`);
  await admin.close();
});
test.afterAll(() => closeDb());

test("Highlights and the admin's second list (with its own heading) are shown, bigger than before", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wear it on" })).toBeVisible(); // the heading the admin typed
  await expect(page.getByRole("listitem").filter({ hasText: "Birdwatching" })).toBeVisible();
  const chipSize = await page.getByRole("listitem").filter({ hasText: "Bio-Washed" }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(chipSize).toBeGreaterThanOrEqual(14); // was 11 px
});

test("without items the second list is not shown, and without a heading it says 'Ideal for'", async ({ page, browser }) => {
  await page.goto(`/products/${plainSlug}`);
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ideal for" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Wear it on" })).toHaveCount(0);

  const d = await db();
  await d.collection("products").updateOne({ slug: plainSlug }, { $set: { idealFor: ["Day hikes"] } });
  const admin = await newContext(browser, "admin");
  const created = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  await admin.request.delete(`/api/admin/announcements/${(await created.json()).announcement._id}`);
  await admin.close();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ideal for" })).toBeVisible(); // default label
});

test("three equal tabs span the whole width and open their content below; arrow keys move between them", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/products/${slug}`);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  const boxes = await Promise.all([0, 1, 2].map(async (i) => (await tabs.nth(i).boundingBox())!));
  // equal thirds, side by side, covering the content width (1280 - 2 x 64 margin)
  for (const b of boxes) expect(Math.abs(b.width - boxes[0].width)).toBeLessThanOrEqual(1);
  expect(Math.round(boxes[0].x)).toBe(64);
  expect(Math.round(boxes[2].x + boxes[2].width)).toBe(1280 - 64);

  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("A soft tee made for long days outside.");
  await expect(page.getByRole("tabpanel")).toContainText("Hand-printed");
  await tabs.nth(1).click();
  await expect(page.getByRole("tabpanel")).toContainText("100% organic cotton");
  await expect(page.getByRole("tabpanel")).toContainText("Machine wash cold");
  await tabs.nth(2).click();
  await expect(page.getByRole("tabpanel")).toContainText("7-8 business days");

  await tabs.nth(2).focus();
  await page.keyboard.press("ArrowRight"); // wraps to the first
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft"); // and back to the last
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
});

test("the gap between the product section and the tabs is modest, at desktop and phone widths", async ({ page }) => {
  for (const [width, height] of [[1280, 900], [390, 800]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/products/${slug}`);
    await page.waitForLoadState("networkidle");
    const tabBar = (await page.getByRole("tablist").boundingBox())!;
    // the lowest bottom edge of anything above the tab bar inside the product section
    const above = await page.evaluate((barTop) => {
      let lowest = 0;
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom <= barTop + 1 && r.bottom > lowest) lowest = r.bottom;
      }
      return lowest;
    }, tabBar.y);
    expect(tabBar.y - above, `gap at ${width}px`).toBeLessThanOrEqual(96); // was about 150 px
  }
});

test("the admin product form saves the second list's heading and items, shows them again, and the product page uses them", async ({ browser }) => {
  const d = await db();
  const product = (await d.collection("products").findOne({ slug: plainSlug }))!;
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/admin/products/${product._id}/edit`);
  const heading = page.getByPlaceholder("Ideal for", { exact: true });
  const items = page.getByPlaceholder("treks, birdwatching, road trips");
  await expect(heading).toBeVisible({ timeout: 20_000 });

  await heading.fill("Carry it on");
  await items.fill("flights, day hikes");
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/admin/products/${product._id}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save Changes" }).click(),
  ]);
  expect(res.status()).toBe(200);
  expect(await d.collection("products").findOne({ _id: product._id })).toMatchObject({ idealForHeading: "Carry it on", idealFor: ["flights", "day hikes"] });

  // the form shows them again after a reload
  await page.reload();
  await expect(page.getByPlaceholder("Ideal for", { exact: true })).toHaveValue("Carry it on", { timeout: 20_000 });
  await expect(page.getByPlaceholder("treks, birdwatching, road trips")).toHaveValue("flights, day hikes");

  // and the shop page
  const shopper = await browser.newPage();
  await expect.poll(async () => {
    await shopper.goto(`/products/${plainSlug}`);
    return shopper.getByRole("heading", { name: "Carry it on" }).count();
  }, { timeout: 30_000 }).toBe(1);
  await expect(shopper.getByRole("listitem").filter({ hasText: "day hikes" })).toBeVisible();
  await shopper.close();
  await admin.close();
});

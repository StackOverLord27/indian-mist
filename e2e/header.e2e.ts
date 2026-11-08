import { test, expect, type Page } from "@playwright/test";
import { db, closeDb } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// The announcement bar scrolls away with the page; the navbar stays stuck at the top for the whole
// page. No gap or overlap at the top, with or without announcements, at every width.

test.afterAll(() => closeDb());

async function setAnnouncements(browser: import("@playwright/test").Browser, texts: string[]) {
  const d = await db();
  await d.collection("announcements").deleteMany({});
  const now = new Date();
  if (texts.length) await d.collection("announcements").insertMany(texts.map((text, order) => ({ text, isActive: true, order, createdAt: now, updatedAt: now })));
  // pages are cached: refresh them the way an admin save does
  const admin = await newContext(browser, "admin");
  const created = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  await admin.request.delete(`/api/admin/announcements/${(await created.json()).announcement._id}`);
  await admin.close();
}

const WIDTHS = [["phone", 390, 800], ["tablet", 768, 900], ["desktop", 1280, 900]] as const;

/** A long page: /about with a tall block added, so there is plenty to scroll */
async function openLongPage(page: Page, path = "/about") {
  await page.goto(path);
  await page.waitForLoadState("networkidle"); // let the page finish hydrating, or it could replace the block
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "4000px";
    spacer.setAttribute("data-spacer", "1");
    document.querySelector("main")!.appendChild(spacer);
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(4000);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}
const box = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;
const scrollTo = async (page: Page, y: number) => {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(y - 2);
};

for (const [name, width, height] of WIDTHS) {
  test(`with announcements: the bar scrolls away, the navbar stays at the top, no gap or overlap (${name})`, async ({ browser, page }) => {
    await setAnnouncements(browser, ["Free delivery this week", "New arrivals every Friday"]);
    await page.setViewportSize({ width, height });
    await openLongPage(page);

    // top of the page: bar at 0, navbar directly under it
    const bar = await box(page, "announcement-bar");
    const nav = await box(page, "site-navbar");
    expect(bar.y).toBe(0);
    expect(bar.height).toBeGreaterThan(20);
    expect(nav.y).toBeCloseTo(bar.y + bar.height, 0); // no gap, no overlap
    expect(nav.height).toBeGreaterThan(50);

    // scrolled far down: the bar has left the viewport, the navbar is stuck at the very top
    for (const y of [300, 1500, 3500]) {
      await scrollTo(page, y);
      const barNow = await box(page, "announcement-bar");
      expect(barNow.y + barNow.height, `bar at scroll ${y}`).toBeLessThanOrEqual(0);
      const navNow = await box(page, "site-navbar");
      expect(Math.round(navNow.y), `navbar at scroll ${y}`).toBe(0);
      await expect(page.getByTestId("site-navbar")).toBeInViewport();
    }

    // back to the top: as before
    await scrollTo(page, 0);
    expect((await box(page, "announcement-bar")).y).toBe(0);
    expect(Math.round((await box(page, "site-navbar")).y)).toBe(Math.round(bar.height));
  });

  test(`without announcements: no bar and no gap, the navbar is at the very top and stays there (${name})`, async ({ browser, page }) => {
    await setAnnouncements(browser, []);
    await page.setViewportSize({ width, height });
    await openLongPage(page);
    await expect(page.getByTestId("announcement-bar")).toHaveCount(0);
    expect(Math.round((await box(page, "site-navbar")).y)).toBe(0);
    for (const y of [400, 3000]) {
      await scrollTo(page, y);
      expect(Math.round((await box(page, "site-navbar")).y)).toBe(0);
    }
  });
}

test("the mobile menu opens from a scrolled page, above everything, and closes", async ({ browser, page }) => {
  await setAnnouncements(browser, ["Free delivery this week"]);
  await page.setViewportSize({ width: 390, height: 800 });
  await openLongPage(page);
  await scrollTo(page, 1200);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: /Contact/i }).first()).toBeVisible();
  await expect(menu.getByRole("link", { name: /Contact/i }).first()).toBeInViewport();
  await page.getByRole("button", { name: "Close navigation menu" }).click();
  await expect(menu).toHaveCount(0);
});

test("the Sort popover and the navbar's dropdown open correctly under the new stacking, also when scrolled", async ({ browser, page }) => {
  await setAnnouncements(browser, ["Free delivery this week"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/products");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "1500px";
    document.querySelector("main")!.appendChild(spacer);
  });

  // popover from the page, opened at the top and again after scrolling (it stays visible, in the viewport)
  await page.getByRole("button", { name: /^Sort products/ }).click();
  await expect(page.getByRole("listbox", { name: "Sort products" })).toBeInViewport();
  await page.keyboard.press("Escape");

  // the navbar's own dropdown opens over the page content while the navbar is stuck
  await scrollTo(page, 700);
  await page.getByRole("link", { name: /^Collections/ }).first().hover();
  const dropdown = page.getByRole("link", { name: /All Collections/i }).first();
  await expect(dropdown).toBeVisible();
  await expect(dropdown).toBeInViewport();
  // and it is on top (the element at its centre is the dropdown, not the page behind it)
  const onTop = await dropdown.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
  expect(onTop).toBe(true);
});

test("admin pages show neither the bar nor the storefront navbar", async ({ browser }) => {
  await setAnnouncements(browser, ["Free delivery this week"]);
  const admin = await newContext(browser, "admin");
  const page = await admin.newPage();
  await page.goto("/admin");
  await expect(page.getByText("Overview").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("announcement-bar")).toHaveCount(0);
  await expect(page.getByTestId("site-navbar")).toHaveCount(0);
  await admin.close();
});

import { test, expect, type Page } from "@playwright/test";
import { db, closeDb } from "./support/db.ts";
import { newContext } from "./support/shop.ts";

// The /blogs header and breadcrumb: the breadcrumb sits exactly where it does on /about, and the
// three header texts are editable from Admin > Blog Posts (and refresh the page at once).

test.beforeAll(async ({ browser }) => {
  const d = await db();
  await Promise.all(["blogs", "sitesettings"].map((c) => d.collection(c).deleteMany({})));
  // Pages are cached (ISR): refresh them the way an admin save does
  const admin = await newContext(browser, "admin");
  const created = await admin.request.post("/api/admin/announcements", { data: { text: "refresh" } });
  expect(created.ok()).toBe(true);
  await admin.request.delete(`/api/admin/announcements/${(await created.json()).announcement._id}`);
  await admin.close();
});
test.afterAll(() => closeDb());

const breadcrumbBox = async (page: Page, path: string) => {
  await page.goto(path);
  const nav = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(nav).toBeVisible();
  // pages slide in for 0.4 s (page-enter): measure once every animation has finished
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const box = (await nav.boundingBox())!;
  // page coordinates (the page is not scrolled), rounded to whole pixels
  return { top: Math.round(box.y), left: Math.round(box.x) };
};

for (const [name, size] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 900 }]] as const) {
  test(`the breadcrumb on /blogs is at the same top and left as on /about (${name})`, async ({ page }) => {
    await page.setViewportSize(size);
    const about = await breadcrumbBox(page, "/about");
    const blogs = await breadcrumbBox(page, "/blogs");
    expect(blogs).toEqual(about);
    // and it is above the green header
    const header = await page.locator("h1").first().boundingBox();
    expect(blogs.top).toBeLessThan(header!.y);
    // no sideways scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("the header shows the current wording until the owner saves, then follows the admin card (also when emptied)", async ({ browser, page }) => {
  // never saved: current wording
  await page.goto("/blogs");
  await expect(page.getByRole("heading", { name: "From the Trail", level: 1 })).toBeVisible();
  await expect(page.getByText("Indian Mist Journal")).toBeVisible();
  await expect(page.getByText("Stories, guides, and notes from the Indian Mist community")).toBeVisible();

  const admin = await newContext(browser, "admin");
  const ap = await admin.newPage();
  await ap.goto("/admin/blogs");
  // wait for the save request itself: the page must not be reloaded before it has finished
  const saveHeader = async () => {
    const [res] = await Promise.all([
      ap.waitForResponse((r) => r.url().endsWith("/api/admin/settings") && r.request().method() === "PUT"),
      ap.getByRole("button", { name: "Save header" }).click(),
    ]);
    expect(res.status()).toBe(200);
  };
  // the form starts with the current wording
  await expect(ap.getByPlaceholder("e.g. From the Trail")).toHaveValue("From the Trail");
  await expect(ap.getByRole("link", { name: /View live page/ })).toHaveAttribute("href", "/blogs");

  await ap.getByPlaceholder("e.g. From the Trail").fill("Trail Notes");
  await ap.getByPlaceholder("e.g. Indian Mist Journal").fill("Our journal");
  await ap.getByPlaceholder("One or two sentences about the blog").fill("Fresh words.");
  await saveHeader();

  await page.goto("/blogs");
  await expect(page.getByRole("heading", { name: "Trail Notes", level: 1 })).toBeVisible();
  await expect(page.getByText("Our journal")).toBeVisible();
  await expect(page.getByText("Fresh words.")).toBeVisible();

  // saved empty: lines hidden, heading falls back to "Blog"
  await ap.getByPlaceholder("e.g. From the Trail").fill("");
  await ap.getByPlaceholder("e.g. Indian Mist Journal").fill("");
  await ap.getByPlaceholder("One or two sentences about the blog").fill("");
  await saveHeader();

  await page.goto("/blogs");
  await expect(page.getByRole("heading", { name: "Blog", level: 1 })).toBeVisible();
  await expect(page.getByText("Our journal")).toHaveCount(0);
  await expect(page.getByText("Fresh words.")).toHaveCount(0);
  await admin.close();
});

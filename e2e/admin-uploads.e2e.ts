import { test, expect, type Page, type Route } from "@playwright/test";
import { resetShop } from "./support/db.ts";
import { newContext } from "./support/shop.ts";
import { makePhoto, withExifOrientation, multipartFiles, type MultipartFile } from "./support/photos.ts";

// Real admin forms, real browser, photos far above what production accepts. The upload routes are
// answered by the test (a fake "saved" reply) after it has measured what the browser actually sent,
// so nothing is written to Cloudinary or the database.

const REQUEST_TARGET = 4_000_000;
const sizes: string[] = [];
const kb = (n: number) => `${Math.round(n / 1000)} KB`;

test.beforeEach(async () => {
  await resetShop(); // gives the product form a category to pick
});
test.afterAll(() => {
  if (sizes.length) console.log("\nBEFORE / AFTER (what the browser sends)\n" + sizes.join("\n"));
});

/** Answers the next request(s) to a route with a fake success, recording the body for the test. */
async function capture(page: Page, pattern: string, method: string, reply: unknown, status = 201) {
  const seen: { total: number; files: MultipartFile[] }[] = [];
  await page.route(pattern, async (route: Route) => {
    const req = route.request();
    if (req.method() !== method) return route.fallback();
    const body = req.postDataBuffer() ?? Buffer.alloc(0);
    seen.push({ total: Number(req.headers()["content-length"] ?? body.length), files: multipartFiles(body, req.headers()["content-type"] ?? "") });
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(reply) });
  });
  return seen;
}

async function adminPage(browser: import("@playwright/test").Browser) {
  const ctx = await newContext(browser, "admin");
  const page = await ctx.newPage();
  return { ctx, page };
}

const zoneInput = (page: Page) => page.locator('input[type="file"]').first();
const previewLabels = (page: Page) => page.locator("img[alt^='New upload'] + button + div, img[alt^='New upload'] ~ div").filter({ hasText: /KB|MB/ });

async function fillProductBasics(page: Page) {
  await page.getByPlaceholder("e.g. Olive Leaf Tea").fill("E2E Upload Tee");
  await page.locator('input[type="number"][step="0.01"]').first().fill("499");
  await page.locator("textarea").first().fill("A product created by the upload test.");
  await page.locator('[role="combobox"]').first().click();
  await page.getByText("E2E Tees", { exact: true }).last().click({ force: true });
}

test.describe("product form (many photos in one request)", () => {
  test("4 large photos are shrunk, previewed, and the request stays under 4 MB", async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    await page.goto("/admin/products/new");
    const photos = await Promise.all([1, 2, 3, 4].map((i) => makePhoto(page, { width: 4000, height: 3000, seed: i })));
    const before = photos.reduce((s, p) => s + p.length, 0);
    expect(before).toBeGreaterThan(9_000_000); // far above what production would take
    const seen = await capture(page, "**/api/admin/products", "POST", { product: { _id: "x" } });

    await zoneInput(page).setInputFiles(photos.map((buffer, i) => ({ name: `photo-${i + 1}.jpg`, mimeType: "image/jpeg", buffer })));
    await expect(page.getByText(/Optimising image/)).toBeVisible();
    await expect(page.getByText(/Optimising image/)).toBeHidden({ timeout: 60_000 });
    await expect(page.locator("img[alt^='New upload']")).toHaveCount(4);

    // previews are of the compressed files, within the pixel limit
    for (const dims of await page.locator("img[alt^='New upload']").evaluateAll((els) => els.map((e) => [(e as HTMLImageElement).naturalWidth, (e as HTMLImageElement).naturalHeight]))) {
      expect(Math.max(...dims)).toBeLessThanOrEqual(1800);
      expect(Math.max(...dims)).toBeGreaterThan(1000);
    }

    await fillProductBasics(page);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect.poll(() => seen.length, { timeout: 20_000 }).toBe(1);
    const [req] = seen;
    expect(req.files).toHaveLength(4);
    for (const f of req.files) {
      expect(f.type).toBe("image/webp");
      expect(f.bytes).toBeLessThanOrEqual(700_000);
    }
    expect(req.total).toBeLessThan(REQUEST_TARGET);
    sizes.push(`product, 4 photos: ${(before / 1e6).toFixed(1)} MB (${photos.map((p) => kb(p.length)).join(", ")}) -> ${kb(req.total)} request (${req.files.map((f) => kb(f.bytes)).join(", ")})`);
    await ctx.close();
  });

  test("10 large photos share the budget: each smaller, the whole request still under 4 MB", async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    await page.goto("/admin/products/new");
    const photos = await Promise.all(Array.from({ length: 10 }, (_, i) => makePhoto(page, { width: 3200, height: 2400, seed: i + 10, quality: 0.85 })));
    const before = photos.reduce((s, p) => s + p.length, 0);
    const seen = await capture(page, "**/api/admin/products", "POST", { product: { _id: "x" } });
    await zoneInput(page).setInputFiles(photos.map((buffer, i) => ({ name: `p${i}.jpg`, mimeType: "image/jpeg", buffer })));
    await expect(page.locator("img[alt^='New upload']")).toHaveCount(10, { timeout: 120_000 });
    await expect(page.getByText(/Optimising image/)).toBeHidden();
    await fillProductBasics(page);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect.poll(() => seen.length, { timeout: 20_000 }).toBe(1);
    expect(seen[0].files).toHaveLength(10);
    expect(seen[0].total).toBeLessThan(REQUEST_TARGET);
    for (const f of seen[0].files) expect(f.bytes).toBeLessThan(400_000);
    sizes.push(`product, 10 photos: ${(before / 1e6).toFixed(1)} MB -> ${kb(seen[0].total)} request (each ${kb(Math.max(...seen[0].files.map((f) => f.bytes)))} or less)`);
    await ctx.close();
  });

  test("worst case: 10 random-noise photos (nothing compresses them) still fit in one request", async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    await page.goto("/admin/products/new");
    const photos = await Promise.all(Array.from({ length: 10 }, (_, i) => makePhoto(page, { width: 2200, height: 1600, kind: "noise", seed: i + 40 })));
    const before = photos.reduce((s, p) => s + p.length, 0);
    const seen = await capture(page, "**/api/admin/products", "POST", { product: { _id: "x" } });
    await zoneInput(page).setInputFiles(photos.map((buffer, i) => ({ name: `noise${i}.jpg`, mimeType: "image/jpeg", buffer })));
    await expect(page.locator("img[alt^='New upload']")).toHaveCount(10, { timeout: 240_000 });
    await expect(page.getByText(/Optimising image/)).toBeHidden();
    await fillProductBasics(page);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect.poll(() => seen.length, { timeout: 20_000 }).toBe(1);
    expect(seen[0].total).toBeLessThan(REQUEST_TARGET);
    sizes.push(`product, 10 random-noise photos (worst case): ${(before / 1e6).toFixed(1)} MB -> ${kb(seen[0].total)} request`);
    await ctx.close();
  });

  test("a phone photo's EXIF rotation is respected", async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    await page.goto("/admin/products/new");
    // stored landscape 3000 x 2000, tagged "rotate 90°": it should come out portrait
    const stored = withExifOrientation(await makePhoto(page, { width: 3000, height: 2000, seed: 5 }), 6);
    await zoneInput(page).setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: stored });
    const img = page.locator("img[alt^='New upload']");
    await expect(img).toHaveCount(1, { timeout: 60_000 });
    const [w, h] = await img.evaluate((e) => [(e as HTMLImageElement).naturalWidth, (e as HTMLImageElement).naturalHeight]);
    expect(h).toBeGreaterThan(w);
    expect(h).toBeLessThanOrEqual(1800);
    expect(Math.abs(h / w - 1.5)).toBeLessThan(0.05);
    await ctx.close();
  });

  test("transparency is kept, and a small file is left exactly as it is", async ({ browser }) => {
    const { ctx, page } = await adminPage(browser);
    await page.goto("/admin/products/new");
    const transparent = await makePhoto(page, { width: 2400, height: 1800, kind: "transparent", type: "image/png", seed: 7 });
    const small = await makePhoto(page, { width: 900, height: 600, seed: 8, quality: 0.6 });
    expect(small.length).toBeLessThan(300_000);
    const seen = await capture(page, "**/api/admin/products", "POST", { product: { _id: "x" } });
    await zoneInput(page).setInputFiles([
      { name: "cutout.png", mimeType: "image/png", buffer: transparent },
      { name: "small.jpg", mimeType: "image/jpeg", buffer: small },
    ]);
    await expect(page.locator("img[alt^='New upload']")).toHaveCount(2, { timeout: 60_000 });
    // the cut-out corner of the preview (what will be uploaded) is still see-through
    const alpha = await page.locator("img[alt^='New upload']").first().evaluate((e) => {
      const img = e as HTMLImageElement; const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0); return ctx.getImageData(5, 5, 1, 1).data[3];
    });
    expect(alpha).toBe(0);
    await fillProductBasics(page);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect.poll(() => seen.length, { timeout: 20_000 }).toBe(1);
    const [cutout, smallSent] = seen[0].files;
    expect(cutout.type).toBe("image/webp"); // WebP keeps transparency
    expect(smallSent.filename).toBe("small.jpg");
    expect(smallSent.bytes).toBe(small.length);
    expect(Buffer.compare(smallSent.data, small)).toBe(0); // byte for byte
    await ctx.close();
  });
});

test("carousel: several big photos, one request each, each small", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/carousel");
  const photos = await Promise.all([1, 2, 3].map((i) => makePhoto(page, { width: 5000, height: 3333, seed: i + 20 })));
  const seen = await capture(page, "**/api/admin/carousel", "POST", { image: { _id: "x", url: "https://x/y.webp", publicId: "p" } });
  await zoneInput(page).setInputFiles(photos.map((buffer, i) => ({ name: `slide${i}.jpg`, mimeType: "image/jpeg", buffer })));
  await expect(page.getByRole("button", { name: /Save 3 Images/ })).toBeEnabled({ timeout: 120_000 });
  await page.getByRole("button", { name: /Save 3 Images/ }).click();
  await expect.poll(() => seen.length, { timeout: 30_000 }).toBe(3);
  for (const r of seen) {
    expect(r.files).toHaveLength(1);
    expect(r.files[0].bytes).toBeLessThanOrEqual(700_000);
    expect(r.total).toBeLessThan(800_000);
  }
  sizes.push(`carousel, 3 photos: ${photos.map((p) => kb(p.length)).join(", ")} -> ${seen.map((r) => kb(r.total)).join(", ")} (3 requests)`);
  await ctx.close();
});

test("category form: a big cover photo is shrunk and Save waits until it is ready", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/categories/new");
  const photo = await makePhoto(page, { width: 4500, height: 3000, seed: 31 });
  const seen = await capture(page, "**/api/admin/categories", "POST", { category: { _id: "x" } });
  await page.getByPlaceholder("e.g. Wellness").fill("E2E Category");
  await zoneInput(page).setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.locator("img[alt^='New upload']")).toHaveCount(1, { timeout: 60_000 });
  await page.getByRole("button", { name: "Create Category" }).click();
  await expect.poll(() => seen.length, { timeout: 20_000 }).toBe(1);
  expect(seen[0].files[0].bytes).toBeLessThanOrEqual(700_000);
  expect(seen[0].files[0].type).toBe("image/webp");
  sizes.push(`category cover: ${kb(photo.length)} -> ${kb(seen[0].total)} request`);
  await ctx.close();
});

test("About page: gallery photos and the story photo are shrunk before each upload", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/about");
  const photos = await Promise.all([1, 2].map((i) => makePhoto(page, { width: 4000, height: 3000, seed: i + 50 })));
  const seen = await capture(page, "**/api/admin/upload", "POST", { url: "https://res.cloudinary.com/x/a.webp", publicId: "indian-mist/about/a" }, 201);
  await page.getByRole("tab", { name: "Photo Mosaic" }).click();
  await page.locator('input[type="file"][multiple][hidden]').setInputFiles(photos.map((buffer, i) => ({ name: `g${i}.jpg`, mimeType: "image/jpeg", buffer })));
  await expect.poll(() => seen.length, { timeout: 60_000 }).toBe(2);
  for (const r of seen) { expect(r.files[0].bytes).toBeLessThanOrEqual(700_000); expect(r.files[0].type).toBe("image/webp"); }

  await page.getByRole("tab", { name: "Story" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "story.jpg", mimeType: "image/jpeg", buffer: photos[0] });
  await expect.poll(() => seen.length, { timeout: 60_000 }).toBe(3);
  expect(seen[2].files[0].bytes).toBeLessThanOrEqual(700_000);
  sizes.push(`about gallery/story: ${kb(photos[0].length)} -> ${seen.map((r) => kb(r.total)).join(", ")}`);
  await ctx.close();
});

test("size chart keeps more pixels and quality than a photo", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/settings");
  const chart = await makePhoto(page, { width: 4800, height: 3200, kind: "text", type: "image/png" });
  const seen = await capture(page, "**/api/admin/size-chart", "PUT", { sizeChart: { url: "https://x/c.webp", publicId: "c" } }, 200);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: chart });
  await expect.poll(() => seen.length, { timeout: 60_000 }).toBe(1);
  const sent = seen[0].files[0];
  expect(sent.bytes).toBeLessThanOrEqual(1_500_000);
  expect(sent.bytes).toBeGreaterThan(100_000); // not squashed into a blur
  const dims = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes])); return [bmp.width, bmp.height];
  }, sent.data.toString("base64"));
  expect(Math.max(...dims)).toBe(2000); // more than the 1800 of a photo
  sizes.push(`size chart: ${kb(chart.length)} -> ${kb(sent.bytes)} (${dims.join("x")})`);
  await ctx.close();
});

test("a picture that cannot be made small enough is refused in the browser with the reason, and nothing is sent", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/settings");
  const chart = await makePhoto(page, { width: 3000, height: 2000, kind: "text", type: "image/png" });
  // No real picture defeats the encoder at these floors, so make the encoder useless from now on:
  // every attempt "comes out" at 3 MB, whatever the quality or size.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
      if (this.width <= 2) return original.call(this, cb, type, quality); // the WebP support probe
      cb(new Blob([new Uint8Array(3_000_000)], { type: type ?? "image/png" }));
    };
  });
  const seen = await capture(page, "**/api/admin/size-chart", "PUT", { sizeChart: { url: "x", publicId: "y" } }, 200);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: chart });
  await expect(page.getByText(/cannot be made small enough \(limit 1\.5 MB per image\)/).first()).toBeVisible({ timeout: 60_000 });
  expect(seen).toHaveLength(0);
  await ctx.close();
});

// The same failure inside the product form (several photos): the message says how many to add per save
test("when photos cannot fit together, the product form says how many to add per save and stays usable", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/products/new");
  const photos = await Promise.all(Array.from({ length: 6 }, (_, i) => makePhoto(page, { width: 3000, height: 2000, seed: i + 90 })));
  // a useless encoder from now on: every attempt "comes out" at 900 KB, over the share each photo gets
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
      if (this.width <= 2) return original.call(this, cb, type, quality);
      cb(new Blob([new Uint8Array(900_000)], { type: type ?? "image/webp" }));
    };
  });
  await zoneInput(page).setInputFiles(photos.map((buffer, i) => ({ name: `p${i}.jpg`, mimeType: "image/jpeg", buffer })));
  const alert = page.locator('p[role="alert"]'); // (Next.js has its own, empty, role=alert element)
  await expect(alert).toBeVisible({ timeout: 120_000 });
  await expect(alert).toContainText(/too large to save together\. Add up to \d+ now, save, then edit and add the rest/);
  await expect(page.getByRole("button", { name: "Create Product" })).toBeEnabled();
  await ctx.close();
});

test("blog cover is shrunk when picked", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/blogs/new");
  const photo = await makePhoto(page, { width: 4200, height: 2800, seed: 61 });
  await page.locator('input[type="file"]').first().setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer: photo });
  const cover = page.locator("img[src^='blob:']").first();
  await expect(cover).toBeVisible({ timeout: 60_000 });
  const [w, h] = await cover.evaluate((e) => [(e as HTMLImageElement).naturalWidth, (e as HTMLImageElement).naturalHeight]);
  expect(Math.max(w, h)).toBeLessThanOrEqual(1800);
  await ctx.close();
});

test("the server refuses an oversize request with a readable 413, and the admin gets a toast for the platform's own 413", async ({ browser }) => {
  const { ctx, page } = await adminPage(browser);
  await page.goto("/admin/carousel");
  // straight to the real route with 6 MB (what an old, cached admin page would send)
  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(6_000_000)], "huge.jpg", { type: "image/jpeg" }));
    const res = await fetch("/api/admin/carousel", { method: "POST", body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  expect(result.status).toBe(413);
  expect(result.body.message).toMatch(/too large .*limit is 4\.5 MB/);

  // the hosting platform answers its own 413 with plain text: still a readable toast
  const photo = await makePhoto(page, { width: 1600, height: 1000, seed: 70 });
  await page.route("**/api/admin/carousel", (route) => route.request().method() === "POST" ? route.fulfill({ status: 413, contentType: "text/plain", body: "Request Entity Too Large" }) : route.fallback());
  await zoneInput(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: /Save Image/ }).click();
  await expect(page.getByText("This upload is too large. Use fewer or smaller images and try again.").first()).toBeVisible();
  await ctx.close();
});

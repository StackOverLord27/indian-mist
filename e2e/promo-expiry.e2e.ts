import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { db, closeDb, resetShop } from "./support/db.ts";
import { AUTH_DIR, BASE_URL } from "./support/env.ts";

/**
 * Admin > Pricing & Promos: the expiry field is India time (IST). Picking 6:03 PM must still read
 * 6:03 PM afterwards and after a reload, whatever time zone the browser is set to; the stored
 * instant is the matching UTC moment; Clear means no expiry.
 */

const TYPED = "2030-06-20T21:45"; // 9:45 PM on 20 June 2030, India time (a future date, so the promo stays active)
const INSTANT = "2030-06-20T16:15:00.000Z";

test.beforeEach(async () => { await resetShop(); });
test.afterAll(() => closeDb());

async function adminIn(browser: import("@playwright/test").Browser, timezoneId: string) {
  const file = `${AUTH_DIR}/admin.json`;
  if (!fs.existsSync(file)) throw new Error("No saved admin sign-in; global setup did not run.");
  return browser.newContext({ storageState: file, baseURL: BASE_URL, timezoneId, viewport: { width: 1280, height: 1000 } });
}

const expiryField = (page: Page) => page.locator('input[type="datetime-local"]').first();
const savedExpiry = async () => {
  const doc = await (await db()).collection("sitesettings").findOne({});
  const promo = (doc?.pricingSettings?.promoCodes ?? []).find((p: { code: string }) => p.code === "TZTEST");
  return promo ? (promo.expiresAt ? new Date(promo.expiresAt).toISOString() : null) : undefined;
};
async function save(page: Page) {
  await page.getByRole("button", { name: "Save Pricing & Promos" }).click();
  await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 20_000 });
}
async function openTzPromo(page: Page) {
  await page.goto("/admin/pricing");
  await page.getByText("TZTEST").first().click(); // expand the saved promo
  await expect(expiryField(page)).toBeVisible();
}

// [zone, its offset from UTC in minutes on the date used (Date.getTimezoneOffset: minutes UTC is ahead of local)]
for (const [tz, offsetMinutes] of [["Asia/Kolkata", -330], ["UTC", 0], ["America/Los_Angeles", 420]] as const) {
  test(`browser time zone ${tz}: the picked time reads back unchanged, is saved as the right instant, survives a reload; Clear means no expiry`, async ({ browser }) => {
    const ctx = await adminIn(browser, tz);
    const page = await ctx.newPage();
    // the browser really is in that zone
    await page.goto("/admin/pricing");
    expect(await page.evaluate(() => new Date("2030-06-20T16:15:00Z").getTimezoneOffset())).toBe(offsetMinutes);

    await page.getByRole("button", { name: "Add New Promo Code" }).click();
    await page.getByText("NEW CODE").first().click(); // the new card opens
    await page.getByPlaceholder("e.g. SUMMER20").first().fill("TZTEST");
    await page.getByPlaceholder("0", { exact: true }).first().fill("10");

    // the reported bug: the field changed to the UTC time right after picking
    await expiryField(page).fill(TYPED);
    await expect(expiryField(page)).toHaveValue(TYPED);
    await page.waitForTimeout(300); // let React re-render from state, then look again
    expect(await expiryField(page).inputValue()).toBe(TYPED);

    // the label and the hint
    await expect(page.getByText("Expires At (IST)").first()).toBeVisible();
    await expect(page.getByText(/India time \(IST\)\. The code stops working at exactly this minute\. Leave blank for no expiry\./).first()).toBeVisible();

    await save(page);
    expect(await savedExpiry()).toBe(INSTANT);

    // after a reload the field shows exactly what was entered
    await openTzPromo(page);
    await expect(expiryField(page)).toHaveValue(TYPED);

    // Clear: empty means no expiry, saved and reloaded
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(expiryField(page)).toHaveValue("");
    await save(page);
    expect(await savedExpiry()).toBeNull();
    await openTzPromo(page);
    await expect(expiryField(page)).toHaveValue("");
    await expect(page.getByRole("button", { name: "Clear" })).toHaveCount(0); // nothing to clear
    await ctx.close();
  });
}

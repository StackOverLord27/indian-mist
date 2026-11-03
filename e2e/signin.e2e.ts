import { test, expect } from "@playwright/test";
import { CUSTOMER_B } from "./support/env.ts";

// Regression test for a defect these tests found: while signed out, the navbar prefetches /profile
// and the router remembers the answer ("go to the sign-in page"); after signing in, a client-side
// push to /profile replayed that stale redirect and bounced the customer back to the sign-in form.
test("signing in through the form lands on the page the customer asked for", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/signin?callbackUrl=/profile");
  await page.waitForLoadState("networkidle"); // the navbar links have been prefetched by now
  await page.locator('input[name="email"]').fill(CUSTOMER_B.email);
  await page.locator('input[name="password"]').fill(CUSTOMER_B.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/profile", { timeout: 30_000 });
  await expect(page.getByText(CUSTOMER_B.email).first()).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

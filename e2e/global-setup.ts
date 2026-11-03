import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { assertSafe, AUTH_DIR, ADMIN, CUSTOMER_A, CUSTOMER_B, BASE_URL } from "./support/env";
import { seedUsers, closeDb } from "./support/db";

/**
 * Seeds the three accounts and signs each in ONCE through the real sign-in forms, saving the
 * browser state. (Sign-in is rate limited to 5 per minute, so scenarios reuse these sessions.)
 */
export default async function globalSetup(_config: FullConfig) {
  assertSafe();
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await seedUsers();
  await closeDb();

  // Sign-in is limited to 5 per minute and the saved sessions last a while: reuse fresh ones
  const fresh = (file: string) => {
    const f = `${AUTH_DIR}/${file}.json`;
    return fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 8 * 60_000 && JSON.parse(fs.readFileSync(f, "utf8")).cookies?.length > 0;
  };
  const browser = await chromium.launch();
  const signInCustomer = async (who: typeof CUSTOMER_A, file: string) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    const seen: string[] = [];
    page.on("response", async (r) => { if (r.url().includes("/api/auth/")) seen.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()} ${(await r.text().catch(() => "")).slice(0, 60)} set-cookie: ${(await r.headersArray()).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value.replace(/=[^;]*/, "=…")).join(" ## ")}`); });
    await page.goto("/signin?callbackUrl=/profile");
    await page.locator('input[name="email"]').fill(who.email);
    await page.locator('input[name="password"]').fill(who.password);
    await page.locator('button[type="submit"]').click();
    const signedIn = await page.waitForURL((url) => url.pathname === "/profile", { timeout: 30_000 }).then(() => true, () => false);
    if (!signedIn) {
      await page.screenshot({ path: `${AUTH_DIR}/signin-failed-${file}.png` });
      throw new Error(`Signing in as ${file} through the real form did not work. Auth calls: ${seen.join(" | ")}`);
    }
    await ctx.storageState({ path: `${AUTH_DIR}/${file}.json` });
    await ctx.close();
  };
  if (!fresh("customer-a")) await signInCustomer(CUSTOMER_A, "customer-a");
  if (!fresh("customer-b")) await signInCustomer(CUSTOMER_B, "customer-b");
  if (fresh("admin")) { await browser.close(); return; }

  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.locator('button[type="submit"]').click();
  const adminIn = await page.waitForURL((url) => url.pathname.startsWith("/admin") && url.pathname !== "/admin/login", { timeout: 30_000 }).then(() => true, () => false);
  if (!adminIn) {
    await page.screenshot({ path: `${AUTH_DIR}/signin-failed-admin.png` });
    throw new Error(`Admin sign-in did not work. Page text: ${(await page.locator("body").innerText()).slice(0, 300)}`);
  }
  await ctx.storageState({ path: `${AUTH_DIR}/admin.json` });
  await ctx.close();
  await browser.close();
}

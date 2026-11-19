import { test, expect, type Page } from "@playwright/test";
import { BASE_URL, CUSTOMER_A } from "./support/env.ts";
import { newContext, putInBag } from "./support/shop.ts";
import { resetShop } from "./support/db.ts";

/**
 * Customer sessions that end unexpectedly, and customer pages that stay blank.
 * Each test drives a real browser against the production build. Sign-ins are the ones saved by global
 * setup (sign-in is rate limited to 5/minute); "15 minutes later" is simulated by deleting the access
 * cookie, which is exactly what the browser does when its 15-minute Max-Age passes.
 */

const OTHER_ORIGIN = "http://other-site.example"; // never reaches the network: answered by page.route

const cookieNamed = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name);

const refreshCalls = (page: Page) => {
  const calls: number[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith("/api/auth/refresh") && r.request().method() === "POST") calls.push(r.status());
  });
  return calls;
};

test.describe("session survives the access token's 15 minutes (hypothesis a)", () => {
  test("profile loads with only a refresh cookie, without bouncing to sign-in", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    await ctx.clearCookies({ name: "access_token" });
    const page = await ctx.newPage();
    const calls = refreshCalls(page);
    await page.goto("/profile");
    await expect(page.getByText(CUSTOMER_A.email).first()).toBeVisible({ timeout: 20_000 });
    expect(page.url()).not.toContain("/signin");
    expect(calls).toEqual([200]); // exactly one renewal (single flight), and it worked
    expect(await cookieNamed(page, "access_token")).toBeTruthy();
    await ctx.close();
  });

  test("checkout prefill works the same way", async ({ browser }) => {
    const shop = await resetShop();
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await putInBag(page, [{ product: shop.sized, size: "M" }]);
    await ctx.clearCookies({ name: "access_token" });
    const calls = refreshCalls(page);
    await page.goto("/checkout");
    await expect(page.getByPlaceholder("you@example.com")).toHaveValue(CUSTOMER_A.email, { timeout: 20_000 });
    expect(calls).toEqual([200]);
    await ctx.close();
  });
});

test.describe("arriving from another site (hypothesis A) and back from a payment redirect", () => {
  // Chromium decides this for real: a top-level navigation that starts on another site sends
  // SameSite=Strict cookies NOT, and SameSite=Lax cookies YES (it is a safe GET navigation).
  async function arrive(page: Page, how: "link" | "redirect", target: string) {
    // "redirect" is what a payment page does: the shopper clicks on the other site, which answers
    // with a 302 back to the shop. (A navigation typed into the address bar is never cross-site.)
    await page.route(`${OTHER_ORIGIN}/**`, (route) => {
      if (route.request().url().endsWith("/pay-return")) {
        return route.fulfill({ status: 302, headers: { location: `${BASE_URL}${target}` } });
      }
      const href = how === "redirect" ? `${OTHER_ORIGIN}/pay-return` : `${BASE_URL}${target}`;
      return route.fulfill({ contentType: "text/html", body: `<a id="go" href="${href}">go</a>` });
    });
    await page.goto(`${OTHER_ORIGIN}/`);
    await page.locator("#go").click();
  }

  for (const how of ["link", "redirect"] as const) {
    for (const target of ["/profile", "/checkout"]) {
      test(`${how} from another origin to ${target}: the outcome follows the cookies' SameSite value`, async ({ browser }) => {
        const shop = await resetShop();
        const ctx = await newContext(browser, "customer-a");
        const page = await ctx.newPage();
        await putInBag(page, [{ product: shop.sized, size: "M" }]);
        const sameSite = (await cookieNamed(page, "refresh_token"))?.sameSite;
        expect(sameSite).toBe("Lax");
        test.info().annotations.push({ type: "cookie SameSite", description: String(sameSite) });
        console.log(`cookies are SameSite=${sameSite}`);
        // (the saved access cookie may be older than its 15 minutes and gone; the refresh cookie is what matters)
        const accessCookie = await cookieNamed(page, "access_token");
        if (accessCookie) expect(accessCookie.sameSite).toBe(sameSite);

        await arrive(page, how, target);
        if (sameSite === "Lax") {
          await page.waitForURL((u) => u.pathname === target, { timeout: 30_000 });
          if (target === "/profile") await expect(page.getByText(CUSTOMER_A.email).first()).toBeVisible({ timeout: 20_000 });
        } else {
          // Strict: no cookie arrives, the proxy sees a stranger although the session is valid
          await page.waitForURL((u) => u.pathname === "/signin", { timeout: 30_000 });
          // ...and the cookies are still in the jar: a normal same-site visit works
          await page.goto(target);
          expect(new URL(page.url()).pathname).toBe(target);
        }
        await ctx.close();
      });
    }
  }
});

test.describe("profile and checkout never stay blank (hypotheses d)", () => {
  test("a 500 shows an error with Retry; Retry loads the page; the session is kept", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    let fail = true;
    await page.route("**/api/profile*", (route) => (fail ? route.fulfill({ status: 500, json: { message: "boom" } }) : route.continue()));
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    expect(page.url()).toContain("/profile");
    expect(await cookieNamed(page, "refresh_token")).toBeTruthy();
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText(CUSTOMER_A.email).first()).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });

  test("a 429 is a retry state, not a sign-out", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await page.route("**/api/profile*", (route) => route.fulfill({ status: 429, headers: { "retry-after": "3" }, json: { error: "Too many requests" } }));
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    expect(page.url()).toContain("/profile");
    await ctx.close();
  });

  test("a network failure is a retry state", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await page.route("**/api/profile*", (route) => route.abort("connectionreset"));
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });

  test("a renewal that fails with 503 keeps the session and shows Retry", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    await ctx.clearCookies({ name: "access_token" });
    const page = await ctx.newPage();
    await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 503, json: { error: "down" } }));
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    expect(page.url()).toContain("/profile");
    expect(await cookieNamed(page, "refresh_token")).toBeTruthy();
    await ctx.close();
  });

  test("a call that never answers times out into the error state", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await page.route("**/api/profile*", () => { /* never answered */ });
    await page.goto("/profile");
    // a skeleton while waiting, never an empty page
    await expect(page.locator('[data-testid="profile-skeleton"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 40_000 });
    await ctx.close();
  });

  test("checkout prefill: an error shows a notice with Retry and the form stays usable", async ({ browser }) => {
    const shop = await resetShop();
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await putInBag(page, [{ product: shop.sized, size: "M" }]);
    let fail = true;
    await page.route("**/api/profile*", (route) => (fail ? route.fulfill({ status: 500, json: { message: "boom" } }) : route.continue()));
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByPlaceholder("you@example.com")).toHaveValue(CUSTOMER_A.email, { timeout: 20_000 });
    await ctx.close();
  });

  test("a 401 that stays after a successful renewal means signed out", async ({ browser }) => {
    const ctx = await newContext(browser, "customer-a");
    const page = await ctx.newPage();
    await page.route("**/api/profile*", (route) => route.fulfill({ status: 401, json: { message: "Unauthenticated" } }));
    await page.goto("/profile");
    await page.waitForURL((u) => u.pathname === "/signin", { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/profile");
    await ctx.close();
  });
});

test.describe("admin pages when the session check cannot be answered", () => {
  test("a server error shows a message with Retry: no endless spinner, no redirect; Retry then opens the page", async ({ browser }) => {
    const ctx = await newContext(browser, "admin");
    const page = await ctx.newPage();
    let failing = true;
    await page.route("**/api/auth/me", (route) => (failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue()));
    await page.goto("/admin");
    await expect(page.getByText("We could not check your admin session.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/admin"); // not sent to the login page
    failing = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("We could not check your admin session.")).toBeHidden({ timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/admin");
    await ctx.close();
  });

  test("a real 401 that cannot be renewed still goes to the login page", async ({ browser }) => {
    const ctx = await newContext(browser, "admin");
    const page = await ctx.newPage();
    await page.route("**/api/auth/me", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.goto("/admin");
    await page.waitForURL((u) => u.pathname === "/admin/login", { timeout: 20_000 });
    await ctx.close();
  });

  test("a network failure on the renewal shows Retry instead of signing the admin out", async ({ browser }) => {
    const ctx = await newContext(browser, "admin");
    const page = await ctx.newPage();
    await page.route("**/api/auth/me", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/admin");
    await ctx.close();
  });
});

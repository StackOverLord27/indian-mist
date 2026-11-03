import fs from "node:fs";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { AUTH_DIR, BASE_URL } from "./env";
import type { Seeded } from "./db";

export type Who = "customer-a" | "customer-b" | "admin";

/** A fresh browser context signed in as the given account (state saved by global setup). */
export async function newContext(browser: Browser, who: Who): Promise<BrowserContext> {
  const file = `${AUTH_DIR}/${who}.json`;
  if (!fs.existsSync(file)) throw new Error(`No saved sign-in for ${who}; global setup did not run.`);
  return browser.newContext({ storageState: file, baseURL: BASE_URL, viewport: { width: 1280, height: 900 } });
}

type Line = { product: Seeded["sized"]; quantity?: number; size?: string; price?: number; maxQuantity?: number };

/** Puts items in the bag exactly the way the site stores them (the "indian-mist-cart" localStorage entry). */
export async function putInBag(page: Page, lines: Line[]) {
  const items = lines.map((l) => ({
    id: l.product.id, slug: l.product.slug, name: l.product.name, category: "e2e-tees",
    price: l.price ?? l.product.price, image: "https://placehold.co/400x500/png",
    ...(l.size && { size: l.size }), quantity: l.quantity ?? 1, ...(l.maxQuantity !== undefined && { maxQuantity: l.maxQuantity }),
  }));
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem("__e2e_cart_set")) {
      window.localStorage.setItem("indian-mist-cart", JSON.stringify({ state: { items: value }, version: 0 }));
      window.localStorage.setItem("__e2e_cart_set", "1");
    }
  }, items);
}

export async function fillShipping(page: Page) {
  await page.getByPlaceholder("123 Main Street, Apt 4B").fill("12 Test Lane");
  await page.getByPlaceholder("Mumbai").fill("Pune");
  await page.getByPlaceholder("Maharashtra").fill("Maharashtra");
  await page.getByPlaceholder("400001").fill("411001");
}

export async function openCheckout(page: Page) {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  // the profile fills name/email/phone once it has loaded
  await expect(page.getByPlaceholder("you@example.com")).not.toHaveValue("", { timeout: 20_000 });
  await fillShipping(page);
}

export const payButton = (page: Page) => page.locator("#checkout-pay-button");

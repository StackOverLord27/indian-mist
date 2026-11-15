import { revalidatePath } from "next/cache";

/**
 * Call after any admin change that visitors can see.
 *
 * The root layout renders the navbar categories/collections, the announcement bar and the
 * footer, and every prerendered page embeds that output. Revalidating the "layout" type at "/"
 * invalidates the root layout, every layout under it and every page under those (see the
 * revalidatePath docs), so the change shows up on all pages, not just the home page.
 * The refresh happens on the next visit to each page.
 */
export function revalidateStorefront() {
  revalidatePath("/", "layout");
}

/**
 * Lighter version for shop activity (a sale or a cancellation changed stock or a "Sold Out"
 * badge): refreshes the pages that show products, not the whole site.
 */
export function revalidateCatalog() {
  revalidatePath("/");
  revalidatePath("/collections");
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
}

// Stock holds are taken and given back all day (every checkout start, every closed payment
// window, every expired sweep). Invalidating every product page each time would make each visitor's
// next page view a fresh render for no reason, so these go through a gate: at most one
// invalidation per server instance every few seconds. A change that lands inside that gap is
// picked up by the pages' own 60-second refresh at the latest.
export const CATALOG_REVALIDATE_MIN_GAP_MS = 5_000;
let lastCatalogRevalidateAt = 0;

/** revalidateCatalog, but at most once per CATALOG_REVALIDATE_MIN_GAP_MS per server instance. Returns whether it ran. Route handlers only (never during rendering). */
export function revalidateCatalogThrottled(now: number = Date.now()): boolean {
  if (now - lastCatalogRevalidateAt < CATALOG_REVALIDATE_MIN_GAP_MS) return false;
  lastCatalogRevalidateAt = now;
  revalidateCatalog();
  return true;
}

export function resetCatalogThrottleForTests() {
  lastCatalogRevalidateAt = 0;
}

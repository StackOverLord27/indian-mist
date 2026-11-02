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

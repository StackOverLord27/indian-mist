import type { CartItem } from "@/lib/cart-store";

export type CartCheckResult = {
  /** The id the cart sent (a database id or an older slug) */
  productId: string;
  /** The product's real database id, when it still exists */
  canonicalId?: string;
  size?: string;
  available: boolean;
  reason?: string;
  /** Unavailable because stock ran out (as opposed to deleted or no longer offered in that size) */
  outOfStock?: boolean;
  slug?: string;
  name?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  color?: string;
  maxQuantity?: number;
};

const lineKey = (id: string, size?: string) => `${id}::${size ?? ""}`;

const capQuantity = (item: CartItem, quantity: number) =>
  item.maxQuantity !== undefined ? Math.min(quantity, Math.max(item.maxQuantity, 1)) : quantity;

/** Merges lines that point at the same product + size into one. */
export function mergeDuplicates(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of items) {
    const key = lineKey(item.id, item.size);
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? { ...existing, ...item, quantity: capQuantity(item, existing.quantity + item.quantity) }
        : item,
    );
  }
  return [...merged.values()];
}

const same = (item: CartItem, r: CartCheckResult) =>
  item.id === r.productId && (item.size ?? undefined) === (r.size ?? undefined);

/**
 * Brings cart lines in line with what the server says: refreshes price/name/image/colour and
 * the stock limit, lowers quantities that exceed stock, and drops lines that can no longer be
 * bought (out-of-stock ones are also returned so they can go to the wishlist). Returns the new
 * lines and short messages describing what changed.
 */
export function applyCartCheck(items: CartItem[], results: CartCheckResult[]) {
  const notes: string[] = [];
  const next: CartItem[] = [];
  const outOfStock: CartItem[] = [];

  for (const item of items) {
    const r = results.find((x) => same(item, x));
    if (!r) {
      next.push(item); // no answer for this line: leave it alone
      continue;
    }
    if (!r.available) {
      if (r.outOfStock) {
        outOfStock.push({ ...item, id: r.canonicalId ?? item.id, slug: r.slug ?? item.slug, name: r.name ?? item.name, image: r.image || item.image });
        notes.push(`${item.name} ${r.reason ?? "is out of stock"}. We moved it to your wishlist`);
      } else {
        notes.push(`${item.name} ${r.reason ?? "is no longer available"} and was removed from your bag`);
      }
      continue;
    }

    const updated: CartItem = {
      ...item,
      id: r.canonicalId ?? item.id,
      slug: r.slug ?? item.slug,
      name: r.name ?? item.name,
      price: r.price ?? item.price,
      originalPrice: r.originalPrice,
      image: r.image || item.image,
      color: r.color,
      maxQuantity: r.maxQuantity,
    };
    if (r.price !== undefined && r.price !== item.price) {
      notes.push(`The price of ${updated.name} changed`);
    }
    if (r.maxQuantity !== undefined && item.quantity > r.maxQuantity) {
      updated.quantity = r.maxQuantity;
      notes.push(`Only ${r.maxQuantity} of ${updated.name} available, quantity lowered`);
    }
    next.push(updated);
  }
  return { items: mergeDuplicates(next), notes, outOfStock: mergeDuplicates(outOfStock) };
}

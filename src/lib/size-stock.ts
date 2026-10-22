/**
 * Builds the per-size stock list saved on a product: one entry per selected size, only
 * when stock tracking is on. Missing or invalid counts become 0.
 */
export function buildSizeStock(
  sizes: string[],
  counts: Record<string, unknown>,
  trackInventory: boolean,
): { size: string; quantity: number }[] {
  if (!trackInventory) return [];
  return sizes.map((size) => ({
    size,
    quantity: Math.max(0, Math.floor(Number(counts[size]) || 0)),
  }));
}

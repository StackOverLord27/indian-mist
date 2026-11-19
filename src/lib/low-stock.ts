import dbConnect from "@/lib/db";
import { Product } from "@/models/product.model";
import Settings from "@/models/settings.model";
import type { SiteSettings } from "@/types/admin";

/**
 * Optional "low stock" alert to the owner: when a product with stock tracking falls to the
 * threshold. OFF unless the admin switched it on (Admin > Site Settings > Customer e-mails).
 * There is no per-product threshold in the shop, so ONE number applies to every product.
 *
 * Once per drop: noticing a product at or below the threshold sets `lowStockAlertedAt` in one
 * atomic update (only one caller wins), and the owner is told once. The flag is cleared when the
 * stock is seen back above the threshold (units returned, restock), so the NEXT drop alerts again.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export async function lowStockSettings(): Promise<{ enabled: boolean; threshold: number }> {
  await dbConnect();
  const s = await Settings.findOne().select("emailSettings").lean<SiteSettings>();
  const t = s?.emailSettings?.lowStockThreshold;
  return {
    enabled: s?.emailSettings?.ownerLowStockAlert === true,
    threshold: typeof t === "number" && Number.isFinite(t) && t >= 0 ? Math.floor(t) : DEFAULT_LOW_STOCK_THRESHOLD,
  };
}

/** Products that have just fallen to the threshold (claimed: each is returned to exactly one caller). */
export async function claimLowStock(productIds: unknown[]): Promise<{ productId: string; at: number }[]> {
  const { enabled, threshold } = await lowStockSettings();
  if (!enabled || !productIds.length) return [];
  const claimed: { productId: string; at: number }[] = [];
  for (const id of new Set(productIds.map(String))) {
    const at = new Date();
    const hit = await Product.findOneAndUpdate(
      { _id: id, trackInventory: true, lowStockAlertedAt: { $exists: false }, stockQuantity: { $lte: threshold } },
      { $set: { lowStockAlertedAt: at } },
      { projection: { _id: 1 } },
    ).lean();
    if (hit) claimed.push({ productId: id, at: at.getTime() });
  }
  await resetLowStockFlags(productIds); // the ones that are back above the threshold
  return claimed;
}

/** Stock is back above the threshold: the next drop may alert again. Cheap, never throws. */
export async function resetLowStockFlags(productIds: unknown[]): Promise<void> {
  try {
    if (!productIds.length) return;
    const { threshold } = await lowStockSettings();
    await Product.updateMany(
      { _id: { $in: [...new Set(productIds.map(String))] }, lowStockAlertedAt: { $exists: true }, stockQuantity: { $gt: threshold } },
      { $unset: { lowStockAlertedAt: 1 } },
    );
  } catch (error) {
    console.error(`[low-stock] could not reset the flags: ${error instanceof Error ? error.name : "error"}`);
  }
}

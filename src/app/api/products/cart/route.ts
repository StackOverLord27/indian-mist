export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { Product } from "@/models/product.model";
import type { CartCheckResult } from "@/lib/cart-sync";

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        size: z.string().trim().max(40).optional(),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Tells the cart what is true right now for each line: current price, name, image, colour
 * and how many units can still be bought. The cart is kept in the browser, so it can go stale
 * or be edited; this is how it is corrected. Payment always re-checks everything on the server.
 */
export const POST = withDB(async (req: NextRequest) => {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid request", 400);

  // Older bags and cards identified products by slug, so accept either
  const keys = [...new Set(parsed.data.items.map((i) => i.productId))];
  const ids = keys.filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: keys } }] })
    .select("slug name price originalPrice images sizes badge trackInventory stockQuantity sizeStock colorName")
    .lean();
  const byId = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    byId.set(String(p._id), p);
    byId.set(p.slug, p);
  }

  const results: CartCheckResult[] = parsed.data.items.map(({ productId, size }) => {
    const p = byId.get(productId);
    const fail = (reason: string, outOfStock = false): CartCheckResult => ({
      productId,
      canonicalId: p ? String(p._id) : undefined,
      size,
      available: false,
      reason,
      outOfStock,
      // Enough to put the product on the wishlist
      ...(p && {
        slug: p.slug,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice || undefined,
        image: p.images?.[0]?.url || "",
      }),
    });
    if (!p) return fail("is no longer available");
    if (p.badge === "Sold Out") return fail("is sold out", true);
    if (p.sizes?.length && !size) return fail("needs a size, please add it again");
    if (p.sizes?.length && size && !p.sizes.includes(size)) return fail(`is no longer available in size ${size}`);

    let maxQuantity: number | undefined;
    if (p.trackInventory) {
      const perSize = !!p.sizeStock?.length;
      maxQuantity = perSize ? (p.sizeStock!.find((s) => s.size === size)?.quantity ?? 0) : (p.stockQuantity ?? 0);
      if (maxQuantity <= 0) return fail(size ? `is out of stock in size ${size}` : "is out of stock", true);
    }

    return {
      productId,
      canonicalId: String(p._id),
      size,
      available: true,
      slug: p.slug,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || undefined,
      image: p.images?.[0]?.url || "",
      color: p.colorName || undefined,
      maxQuantity,
    };
  });

  return successResponse({ results });
});

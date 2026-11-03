import type { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Product as ProductModel } from "@/models/product.model";
import { getCategoryNames } from "@/lib/storefront-data";
import { categoryLabel } from "@/lib/category-labels";
import type { Product, ProductBadge } from "@/lib/homepage-data";

/** Products shown per collection on the /collections overview (the rest are one click away). */
export const COLLECTION_PREVIEW_SIZE = 8;
/** Products per batch on a collection's own page ("Load more"). */
export const COLLECTION_PAGE_SIZE = 24;
export const COLLECTION_MAX_PAGE_SIZE = 60;

export type PopulatedProduct = {
  _id: { toString(): string };
  slug?: string;
  name: string;
  category: string;
  price: number;
  badge?: ProductBadge | "";
  sizes?: string[];
  images?: { url?: string; alt?: string }[];
};

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export function toCardProduct(p: PopulatedProduct, names?: Record<string, string>): Product {
  return {
    id: p.slug || p._id.toString(),
    productId: p._id.toString(),
    name: p.name,
    category: names ? categoryLabel(names, p.category) : p.category,
    price: formatPrice(p.price),
    badge: p.badge || undefined,
    sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
    image: {
      src: p.images?.[0]?.url || undefined,
      alt: p.images?.[0]?.alt || p.name,
      fallbackClassName: "bg-olive-leaf/20",
    },
  };
}

const CARD_FIELDS = "slug name category price badge sizes images";

/**
 * The products with these ids, in the order of the ids, for the product cards. Ids whose product
 * no longer exists are skipped. One query for any number of ids.
 */
export async function getProductsByIds(ids: (Types.ObjectId | string)[]): Promise<PopulatedProduct[]> {
  if (ids.length === 0) return [];
  await dbConnect();
  const docs = await ProductModel.find({ _id: { $in: ids } }).select(CARD_FIELDS).lean<PopulatedProduct[]>();
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  return ids.map((id) => byId.get(String(id))).filter((p): p is PopulatedProduct => Boolean(p));
}

/** One batch of a collection's products as card data; `total` is how many products it holds. */
export async function getCollectionBatch(
  productIds: (Types.ObjectId | string)[],
  page: number,
  limit: number,
): Promise<{ cards: Product[]; total: number; hasMore: boolean }> {
  const size = Math.min(Math.max(1, Math.floor(limit) || COLLECTION_PAGE_SIZE), COLLECTION_MAX_PAGE_SIZE);
  const start = (Math.max(1, Math.floor(page) || 1) - 1) * size;
  const [products, names] = await Promise.all([getProductsByIds(productIds.slice(start, start + size)), getCategoryNames()]);
  return {
    cards: products.map((p) => toCardProduct(p, names)),
    total: productIds.length,
    hasMore: start + size < productIds.length,
  };
}

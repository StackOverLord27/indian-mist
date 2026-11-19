import dbConnect from "@/lib/db";
import { Product } from "@/models/product.model";
import { PRODUCT_SORT, withIdTieBreaker } from "@/lib/product-sort";
import { escapeRegex } from "@/lib/pagination";
import { imageUrls, type ProductFacetItem } from "@/types/product-facets";
import { getCategoryNames } from "@/lib/storefront-data";
import { categoryLabel } from "@/lib/category-labels";

/**
 * The ONE place the public product listing is built. The /products page (first batch) and
 * /api/products (every later batch, filters, search) both call getProductListing, so labels,
 * counts, sorting and tie-breaks cannot drift apart.
 */

export const LISTING_PAGE_SIZE = 12;
export const LISTING_MAX_LIMIT = 60;
const LISTING_MAX_PAGE = 1000;

export type SortKey = "featured" | "newest" | "price-low" | "price-high" | "name-asc" | "name-desc";

const SORTS: Record<SortKey, Record<string, 1 | -1>> = {
  featured: { ...PRODUCT_SORT },
  newest: { createdAt: -1 },
  "price-low": { price: 1 },
  "price-high": { price: -1 },
  "name-asc": { name: 1 },
  "name-desc": { name: -1 },
};

export type ListingQuery = {
  page: number;
  limit: number;
  sort: SortKey;
  categories: string[];
  badges: string[];
  q: string;
};

export type ListingProduct = {
  id: string;
  slug: string;
  name: string;
  /** The category slug (used for filtering) */
  category: string;
  /** The category's real name (shown to shoppers) */
  categoryLabel: string;
  price: string;
  images: string[];
  badge?: "New" | "Sale" | "Sold Out";
  hasSizes: boolean;
  sizes?: string[];
};

export type FacetItem = { name: string; value: string; count: number };
export type ListingFacets = { categories: FacetItem[]; badges: FacetItem[] };
export type Listing = { products: ListingProduct[]; facets: ListingFacets; total: number; hasMore: boolean };

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

const wholeNumber = (value: string | null): number | null => {
  if (value == null || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) ? n : null;
};
const list = (value: string | null) => (value ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 50);

/** Public limits: 12 per batch by default, at most 60; page 1..1000; unknown sort = featured. */
export function parseListingQuery(params: URLSearchParams): ListingQuery {
  const page = wholeNumber(params.get("page"));
  const limit = wholeNumber(params.get("limit"));
  const sort = params.get("sort") ?? "featured";
  return {
    page: page === null || page < 1 ? 1 : Math.min(page, LISTING_MAX_PAGE),
    limit: limit === null || limit < 1 ? LISTING_PAGE_SIZE : Math.min(limit, LISTING_MAX_LIMIT),
    sort: (sort in SORTS ? sort : "featured") as SortKey,
    categories: list(params.get("category")),
    badges: list(params.get("badge")),
    q: (params.get("q") ?? "").trim().slice(0, 80),
  };
}

type Counted = { _id: string | null; count: number };
type Facet = { data?: ProductFacetItem[]; totalCount?: { count: number }[]; categories?: Counted[]; badges?: Counted[] };

/**
 * Facet rule: each facet's counts apply every filter EXCEPT its own, so picking one category
 * does not hide the other categories (and picking a badge does not hide other badges). The
 * product list and the total apply all of them.
 */
export async function getProductListing(query: ListingQuery): Promise<Listing> {
  await dbConnect();

  const categoryMatch = query.categories.length ? { category: { $in: query.categories } } : {};
  const badgeMatch = query.badges.length ? { badge: { $in: query.badges } } : {};
  const skip = (query.page - 1) * query.limit;

  const [result, names] = await Promise.all([
    Product.aggregate<Facet>([
      ...(query.q ? [{ $match: { name: { $regex: escapeRegex(query.q), $options: "i" } } }] : []),
      {
        $facet: {
          data: [
            { $match: { ...categoryMatch, ...badgeMatch } },
            { $sort: withIdTieBreaker(SORTS[query.sort]) },
            { $skip: skip },
            { $limit: query.limit },
            { $project: { slug: 1, name: 1, category: 1, price: 1, images: 1, badge: 1, sizes: 1 } },
          ],
          totalCount: [{ $match: { ...categoryMatch, ...badgeMatch } }, { $count: "count" }],
          categories: [{ $match: badgeMatch }, { $group: { _id: "$category", count: { $sum: 1 } } }],
          badges: [{ $match: categoryMatch }, { $group: { _id: "$badge", count: { $sum: 1 } } }],
        },
      },
    ]),
    getCategoryNames(),
  ]);

  const r = result[0] ?? {};
  const total = r.totalCount?.[0]?.count ?? 0;

  const products: ListingProduct[] = (r.data ?? []).map((p) => ({
    id: p._id?.toString() ?? "",
    slug: p.slug ?? "",
    name: p.name ?? "",
    category: p.category ?? "",
    categoryLabel: categoryLabel(names, p.category ?? ""),
    price: formatPrice(p.price ?? 0),
    images: imageUrls(p.images),
    badge: p.badge || undefined,
    hasSizes: Array.isArray(p.sizes) && p.sizes.length > 0,
    sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
  }));

  // A ticked filter must stay visible (and untickable) even when it has no products under the other filters
  const withSelected = (counted: Counted[], selected: string[]) => {
    const map = new Map(counted.filter((c) => c._id).map((c) => [c._id as string, c.count]));
    for (const s of selected) if (!map.has(s)) map.set(s, 0);
    return map;
  };

  const categories: FacetItem[] = [...withSelected(r.categories ?? [], query.categories)]
    .map(([slug, count]) => ({ name: categoryLabel(names, slug), value: slug, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const badges: FacetItem[] = [...withSelected(r.badges ?? [], query.badges)]
    .map(([badge, count]) => ({ name: badge, value: badge, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { products, facets: { categories, badges }, total, hasMore: skip + query.limit < total };
}

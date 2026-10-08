import dbConnect from "@/lib/db";
import { imageUrls, type ProductFacetResult } from "@/types/product-facets";
import { Product } from "@/models/product.model";
import ProductsClient from "@/components/products/ProductsClient";

export const revalidate = 60;

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category, sort } = await searchParams;
  const initialCategory = typeof category === "string" ? category : undefined;
  const initialSort = typeof sort === "string" ? sort : undefined;

  await dbConnect();

  const matchStage: Record<string, unknown> = {};
  if (initialCategory) matchStage.category = initialCategory;

  let sortStage: Record<string, 1 | -1> = { order: 1, createdAt: -1 };
  if (initialSort === "newest") sortStage = { createdAt: -1 };
  else if (initialSort === "price-low") sortStage = { price: 1 };
  else if (initialSort === "price-high") sortStage = { price: -1 };
  else if (initialSort === "name-asc") sortStage = { name: 1 };
  else if (initialSort === "name-desc") sortStage = { name: -1 };

  const result = await Product.aggregate([
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $facet: {
        data: [
          { $sort: sortStage },
          { $limit: 12 },
          {
            $project: {
              slug: 1,
              name: 1,
              category: 1,
              price: 1,
              images: 1,
              badge: 1,
              sizes: 1
            }
          }
        ],
        totalCount: [{ $count: "count" }],
        categories: [
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        badges: [
          { $group: { _id: "$badge", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      }
    }
  ]);

  const facetResult: ProductFacetResult = result[0] ?? {};

  const formattedProducts = (facetResult.data ?? []).map((p) => ({
    id: p._id?.toString() ?? "",
    slug: p.slug ?? "",
    name: p.name ?? "",
    category: p.category ?? "",
    price: formatPrice(p.price ?? 0),
    images: imageUrls(p.images),
    badge: p.badge || undefined,
    hasSizes: Array.isArray(p.sizes) && p.sizes.length > 0,
    sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
  }));

  const total = facetResult.totalCount?.[0]?.count || 0;

  const initialFacets = {
    categories: (facetResult.categories ?? []).map((c) => ({ name: c._id, value: c._id, count: c.count })),
    badges: (facetResult.badges ?? [])
      .filter((b): b is { _id: string; count: number } => Boolean(b._id))
      .map((b) => ({ name: b._id, value: b._id, count: b.count })),
  };

  return <ProductsClient
    initialProducts={formattedProducts}
    initialFacets={initialFacets}
    initialHasMore={12 < total}
    initialTotal={total}
    initialCategory={initialCategory}
    initialSort={initialSort}
  />;
}

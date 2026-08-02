import dbConnect from "@/lib/db";
import { Product } from "@/models/Product";
import ProductsClient from "@/components/products/ProductsClient";

export const revalidate = 0; // Prevent caching for now if we want fresh data, or remove if static

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export default async function ProductsPage() {
  await dbConnect();
  const result = await Product.aggregate([
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $limit: 12 },
          { 
            $project: {
              slug: 1,
              name: 1,
              category: 1,
              price: 1,
              images: 1,
              badge: 1
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

  const facetResult = result[0];
  
  const formattedProducts = facetResult.data.map((p: any) => ({
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: formatPrice(p.price),
    images: p.images || [],
    badge: p.badge,
  }));

  const total = facetResult.totalCount[0]?.count || 0;
  
  const initialFacets = {
    categories: facetResult.categories.map((c: any) => ({ name: c._id, count: c.count })),
    badges: facetResult.badges
      .filter((b: any) => b._id) 
      .map((b: any) => ({ name: b._id, count: b.count })),
  };

  return <ProductsClient 
    initialProducts={formattedProducts} 
    initialFacets={initialFacets} 
    initialHasMore={12 < total}
  />;
}

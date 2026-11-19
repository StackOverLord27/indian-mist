import { getProductListing, parseListingQuery, LISTING_PAGE_SIZE } from "@/lib/product-listing";
import ProductsClient from "@/components/products/ProductsClient";
import { PageEnter } from "@/components/ui/PageEnter";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "All Products", description: "Browse our full range.", path: "/products" });

// This page reads searchParams (?category=, ?sort=), so it is rendered on every request. A
// `revalidate` export would be ignored. Caching decision (docs checked): `unstable_cache` is
// deprecated in Next.js 16 and its replacement `use cache` needs Cache Components, which changes
// how the whole app renders; not worth it for one aggregate query per visit. The API route and
// the page share one function, so if caching is ever added it is added in one place.

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category, sort } = await searchParams;
  const params = new URLSearchParams();
  if (typeof category === "string") params.set("category", category);
  if (typeof sort === "string") params.set("sort", sort);

  // Exactly what /api/products?limit=12&page=1 returns for the same filters
  const query = { ...parseListingQuery(params), page: 1, limit: LISTING_PAGE_SIZE };
  const listing = await getProductListing(query);

  return (
    <PageEnter>
      <ProductsClient
        initialProducts={listing.products}
        initialFacets={listing.facets}
        initialHasMore={listing.hasMore}
        initialTotal={listing.total}
        initialCategories={query.categories}
        initialSort={query.sort}
      />
    </PageEnter>
  );
}

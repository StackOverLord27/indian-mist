"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductCard } from "@/components/home/ProductCard";
import type { Product } from "@/lib/homepage-data";

/**
 * A collection's products. The page renders the first batch on the server (so the page stays
 * cached); "Load more" fetches the following batches from /api/collections/[slug]/products.
 */
export function CollectionProductGrid({
  slug,
  initialProducts,
  initialHasMore,
  pageSize,
}: {
  slug: string;
  initialProducts: Product[];
  initialHasMore: boolean;
  pageSize: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(slug)}/products?page=${page + 1}&limit=${pageSize}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { cards: Product[]; hasMore: boolean };
      // a product could appear twice if the collection changed meanwhile
      setProducts((prev) => [...prev, ...data.cards.filter((c) => !prev.some((p) => p.productId === c.productId))]);
      setHasMore(data.hasMore);
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.productId ?? p.id} product={p} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-olive-leaf/30 px-6 py-3 font-montserrat text-xs font-semibold uppercase tracking-widest text-forest transition-colors hover:bg-forest hover:text-cornsilk disabled:opacity-60"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {loading ? "Loading…" : "Load more"}
          </button>
          {failed && <p className="font-montserrat text-xs text-copper">Couldn't load more products. Please try again.</p>}
        </div>
      )}
    </>
  );
}

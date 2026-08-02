"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { ProductCard } from "@/components/home/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import type { Product } from "@/lib/homepage-data";

type FeaturedProductsProps = {
  products: Product[];
};

/** Number of products to render per batch */
const BATCH_SIZE = 8;

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, products.length));
  }, [products.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <section className="bg-cornsilk px-6 py-16 md:px-12">
      <div className="mb-8 flex items-end justify-between gap-6">
        <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
          Featured products
        </h2>
        <Link
          href="/products"
          className="font-sans text-xs font-medium uppercase tracking-widest text-olive-leaf transition-opacity hover:opacity-70"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}

        {/* Skeleton placeholders for upcoming batch */}
        {hasMore &&
          Array.from({ length: Math.min(BATCH_SIZE, products.length - visibleCount) }).map((_, i) => (
            <ProductCardSkeleton key={`skel-${i}`} />
          ))}
      </div>

      {/* Scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { ProductCard } from "@/components/home/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import type { Arrival } from "@/lib/homepage-data";

type NewestArrivalsProps = {
  arrivals: Arrival[];
};

const BATCH_SIZE = 8;

export function NewestArrivals({ arrivals }: NewestArrivalsProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, arrivals.length));
  }, [arrivals.length]);

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

  const visible = arrivals.slice(0, visibleCount);
  const hasMore = visibleCount < arrivals.length;

  if (!arrivals || arrivals.length === 0) return null;

  return (
    <section className="bg-warm-mist px-4 py-16 sm:px-6 md:px-12">
      <div className="mx-auto max-w-screen-2xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
            Newest arrivals
          </h2>
          <Link
            href="/products?sort=newest"
            className="font-sans text-xs font-medium uppercase tracking-widest text-olive-leaf transition-opacity hover:opacity-70"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {visible.map((arrival) => (
            <ProductCard
              key={arrival.id}
              hideNewBadge
              product={{
                id: arrival.id,
                name: arrival.name,
                category: arrival.category,
                price: arrival.price,
                badge: arrival.badge,
                image: arrival.image,
                sizes: arrival.sizes,
              }}
            />
          ))}

          {hasMore &&
            Array.from({ length: Math.min(BATCH_SIZE, arrivals.length - visibleCount) }).map((_, i) => (
              <ProductCardSkeleton key={`skel-${i}`} />
            ))}
        </div>

        {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
      </div>
    </section>
  );
}

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ImageSlot } from "@/components/home/ImageSlot";
import { ArrivalCardSkeleton } from "@/components/ui/skeletons";
import type { Arrival } from "@/lib/homepage-data";
import { useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

type NewestArrivalsProps = {
  arrivals: Arrival[];
};

/** Number of arrival cards to render per batch */
const BATCH_SIZE = 6;

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
    <section className="bg-warm-mist px-6 py-16 md:px-12">
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
          Newest arrivals
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {visible.map((arrival) => (
          <ArrivalCard key={arrival.id} arrival={arrival} />
        ))}

        {/* Skeleton placeholders for upcoming batch */}
        {hasMore &&
          Array.from({ length: Math.min(BATCH_SIZE, arrivals.length - visibleCount) }).map((_, i) => (
            <ArrivalCardSkeleton key={`skel-${i}`} />
          ))}
      </div>

      {/* Scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
    </section>
  );
}

function ArrivalCard({ arrival }: { arrival: Arrival }) {
  const { addItem, items } = useCartStore();
  const inCart = items.some((i) => i.id === arrival.id);
  const isSoldOut = arrival.badge === "Sold Out";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inCart || isSoldOut) return;
    addItem({
      id: arrival.id,
      slug: arrival.id,
      name: arrival.name,
      category: arrival.category,
      price: parseFloat(arrival.price.replace(/[^\d.]/g, "")),
      image: arrival.image.src ?? "",
      quantity: 1,
    });
  };

  return (
    <article className={cn("rounded-home-card border border-olive-leaf/10 bg-cornsilk p-3", isSoldOut && "opacity-75")}>
      <div
        className={cn("relative overflow-hidden rounded-home-card", isSoldOut && "opacity-60 grayscale")}
        style={{ aspectRatio: "4 / 3" }}
      >
        <ImageSlot
          image={arrival.image}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {arrival.badge ? (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk",
              arrival.badge === "Sale" ? "bg-copperwood" : arrival.badge === "Sold Out" ? "bg-muted-text/80" : "bg-black-forest"
            )}
          >
            {arrival.badge}
          </span>
        ) : null}
      </div>

      <div className="p-2 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-2xs font-medium uppercase tracking-widest text-olive-leaf">
            {arrival.category}
          </p>
          <span className="rounded-full bg-warm-mist px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-copperwood">
            Just in
          </span>
        </div>
        <h3 className="mt-3 font-serif text-base font-normal text-black-forest">
          {arrival.name}
        </h3>
        <p className="mt-2 font-sans text-xs font-light leading-5 text-black-forest/65">
          {arrival.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="font-serif text-xl font-bold text-black-forest">
            {arrival.price}
          </p>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={inCart || isSoldOut}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-full px-5 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity",
              (inCart || isSoldOut)
                ? "bg-muted-text/30 cursor-not-allowed"
                : "bg-olive-leaf hover:opacity-85"
            )}
          >
            {isSoldOut ? "Sold Out" : inCart ? "Added to bag" : "Add to bag"}
          </button>
        </div>
      </div>
    </article>
  );
}

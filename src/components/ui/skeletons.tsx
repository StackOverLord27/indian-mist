/**
 * skeletons.tsx
 *
 * Composite skeleton layouts built entirely from shadcn's <Skeleton> primitive.
 * Uses the project's design-system tokens (--muted, animate-pulse) automatically
 * — no custom CSS required. Light/dark mode awareness comes for free.
 */

import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ProductCardSkeleton
// Matches the exact dimensions of <ProductCard> from homepage-data.
// ─────────────────────────────────────────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <article className="rounded-home-card border border-olive-leaf/10 bg-card-bg p-3">
      {/* Square image area */}
      <Skeleton className="aspect-square w-full rounded-home-card" />

      {/* Text area */}
      <div className="px-1 pb-1 pt-4 space-y-3">
        <Skeleton className="h-2.5 w-16" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductsGridSkeleton
// Full-page skeleton for /products — header + sort bar + 4-column grid.
// ─────────────────────────────────────────────────────────────────────────────
export function ProductsGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="bg-cornsilk px-6 md:px-12 lg:px-16 pt-12 pb-8 min-h-screen">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-48 rounded-sm" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-16">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-card-surface border border-olive/10 rounded-md overflow-hidden"
          >
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-2 w-14" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArrivalCardSkeleton
// Matches the <ArrivalCard> shape in <NewestArrivals>.
// ─────────────────────────────────────────────────────────────────────────────
export function ArrivalCardSkeleton() {
  return (
    <article className="rounded-home-card border border-olive-leaf/10 bg-cornsilk p-3">
      {/* 4:3 image */}
      <Skeleton className="w-full rounded-home-card" style={{ aspectRatio: "4 / 3" }} />

      <div className="p-2 pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeSkeleton
// Full home-page skeleton: hero + featured products + newest arrivals.
// ─────────────────────────────────────────────────────────────────────────────
export function HomeSkeleton() {
  return (
    <div className="w-full bg-cornsilk">
      {/* Hero */}
      <Skeleton className="w-full h-[60vh] md:h-[80vh] rounded-none" />

      {/* Featured products section */}
      <section className="bg-cornsilk px-6 py-16 md:px-12">
        <div className="mb-8 flex items-end justify-between gap-6">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Newest arrivals section */}
      <section className="bg-warm-mist px-6 py-16 md:px-12">
        <div className="mb-8">
          <Skeleton className="h-7 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ArrivalCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

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
    <article className="overflow-hidden rounded-home-card border border-olive-leaf/10 bg-card-bg p-0 sm:overflow-visible sm:p-3">
      {/* Square image area */}
      <Skeleton className="aspect-square w-full rounded-none sm:rounded-home-card" />

      {/* Text area */}
      <div className="px-3 pb-3 pt-3 sm:px-1 sm:pb-1 sm:pt-4 space-y-3">
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
    <div className="bg-cornsilk px-4 sm:px-6 md:px-12 lg:px-16 pt-12 pb-8 min-h-screen">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-44 rounded-sm" />
          <Skeleton className="h-10 w-24 rounded-sm" />
          <Skeleton className="h-10 w-40 rounded-sm" />
        </div>
      </div>
      <Skeleton className="h-4 w-24 mb-6" />

      {/* Product grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 pb-16">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
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
      <section className="bg-cornsilk px-4 py-16 sm:px-6 md:px-12">
        <div className="mb-8 flex items-end justify-between gap-6">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Newest arrivals section */}
      <section className="bg-warm-mist px-4 py-16 sm:px-6 md:px-12">
        <div className="mb-8">
          <Skeleton className="h-7 w-44" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

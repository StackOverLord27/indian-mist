import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/ui/skeletons";

export default function CollectionsLoading() {
  return (
    <div className="bg-cornsilk pb-16 min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <header className="mt-2 mb-10 pb-8 border-b border-olive/20">
        <div className="space-y-3 max-w-prose">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </header>
      </div>

      <div className="space-y-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className={`py-12 ${i % 2 !== 0 ? "bg-warm-mist/40" : ""}`}>
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16">
            <div className="mb-6 flex items-baseline gap-4">
              <Skeleton className="h-12 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              {Array.from({ length: 4 }).map((_, j) => (
                <ProductCardSkeleton key={j} />
              ))}
            </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

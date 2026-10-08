import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/ui/skeletons";

export default function CollectionsLoading() {
  return (
    <div className="bg-cornsilk px-4 sm:px-6 md:px-12 lg:px-16 pt-12 pb-16 min-h-screen">
      <header className="mb-14 pb-8 border-b border-olive/20">
        <div className="space-y-3 max-w-prose">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </header>

      <div className="space-y-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className={`py-12 ${i % 2 !== 0 ? "bg-warm-mist/40" : ""} -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16`}>
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
          </section>
        ))}
      </div>
    </div>
  );
}

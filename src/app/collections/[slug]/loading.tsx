import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/ui/skeletons";

export default function CollectionDetailLoading() {
  return (
    <div className="bg-cornsilk pb-16 min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <header className="mt-2 mb-10 pb-8 border-b border-olive/20">
          <div className="space-y-3 max-w-prose">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

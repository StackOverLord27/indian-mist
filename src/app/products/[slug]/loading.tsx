import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        {/* Breadcrumb */}
        <div className="pb-4 flex items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-32" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4">
          {/* Image gallery */}
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-md" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-20 h-20 rounded" />
              ))}
            </div>
          </div>

          {/* Product info */}
          <div className="space-y-5">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-7 w-1/2" />
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="size-4 rounded" />
              ))}
            </div>
            <Skeleton className="h-8 w-28" />
            <hr className="border-olive-leaf/10" />
            <div className="space-y-3">
              <Skeleton className="h-3 w-12" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-11 h-10 rounded-sm" />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 flex-1 rounded-sm" />
              <Skeleton className="h-12 w-32 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

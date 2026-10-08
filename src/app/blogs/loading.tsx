import { Skeleton } from "@/components/ui/skeleton";

export default function BlogsLoading() {
  return (
    <div className="bg-cornsilk px-6 md:px-12 lg:px-16 pt-12 pb-16 min-h-screen">
      <div className="mx-auto max-w-screen-2xl">
        <div className="space-y-3 mb-10">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className="rounded-md border border-olive-leaf/10 bg-card-bg overflow-hidden">
              <Skeleton className="aspect-[16/10] w-full" />
              <div className="p-5 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

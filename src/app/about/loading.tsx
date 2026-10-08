import { Skeleton } from "@/components/ui/skeleton";

export default function AboutLoading() {
  return (
    <div className="bg-cornsilk min-h-screen">
      {/* Hero section */}
      <div className="px-6 md:px-12 lg:px-16 pt-16 pb-12">
        <div className="mx-auto max-w-screen-2xl text-center space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto" />
        </div>
      </div>

      {/* Content sections */}
      <div className="px-6 md:px-12 lg:px-16 pb-16 space-y-16">
        <div className="mx-auto max-w-screen-2xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <Skeleton className="aspect-[4/3] w-full rounded-md" />
              <div className="space-y-4 flex flex-col justify-center">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

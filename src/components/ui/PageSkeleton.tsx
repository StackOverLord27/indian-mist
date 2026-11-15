/** A placeholder with the shape of a list page (title and a few rows) so a page waiting for its data is never blank. */
export function PageSkeleton({ label }: { label: string }) {
  const bar = "animate-pulse rounded-sm bg-olive-leaf/10";
  return (
    <div data-testid="page-skeleton" role="status" aria-label={label} className="bg-cornsilk min-h-screen">
      <div className="max-w-page mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        <div className={`${bar} h-4 w-40`} />
        <div className={`${bar} mt-4 h-8 w-64`} />
        <div className={`${bar} mt-2 h-3 w-48`} />
        <div className="mt-8 space-y-4 max-w-3xl">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className={`${bar} h-24 w-20 shrink-0`} />
              <div className="flex-1 space-y-2">
                <div className={`${bar} h-4 w-3/4`} />
                <div className={`${bar} h-3 w-1/3`} />
                <div className={`${bar} h-3 w-1/4`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

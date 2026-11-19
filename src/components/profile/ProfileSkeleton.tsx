/** Placeholder with the same shape as the profile page while it loads (never a blank screen). */
export function ProfileSkeleton() {
  const bar = "animate-pulse rounded-sm bg-olive-leaf/10";
  return (
    <div data-testid="profile-skeleton" role="status" aria-label="Loading your profile" className="bg-cornsilk min-h-screen">
      <div className="max-w-page mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        <div className={`${bar} h-4 w-40`} />
        <div className="mt-6 flex items-center gap-4">
          <div className={`${bar} size-14 rounded-full`} />
          <div className="space-y-2">
            <div className={`${bar} h-5 w-48`} />
            <div className={`${bar} h-3 w-64`} />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-0 border border-olive-leaf/15 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4 border-b border-olive-leaf/15 p-6 lg:border-b-0 lg:border-r">
            <div className={`${bar} h-4 w-32`} />
            <div className={`${bar} h-9 w-full`} />
            <div className={`${bar} h-9 w-full`} />
            <div className={`${bar} h-4 w-32`} />
            <div className={`${bar} h-9 w-full`} />
          </div>
          <div className="space-y-4 p-6">
            <div className={`${bar} h-4 w-40`} />
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${bar} h-20 w-full`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

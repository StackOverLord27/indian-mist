"use client";

import { usePathname } from "next/navigation";

export function AnnouncementBarClient({ displayItems }: { displayItems: string[] }) {
  const pathname = usePathname();

  // Hide announcement bar on all admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk sm:h-7">
      <div className="flex items-center">
        {displayItems.map((text, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && (
              <span className="mx-3 shrink-0 text-sunlit-clay" aria-hidden="true">
                ·
              </span>
            )}
            <span className="block truncate max-w-62.5 sm:max-w-none">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

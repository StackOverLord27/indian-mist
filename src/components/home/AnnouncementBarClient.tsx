"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function AnnouncementBarClient({ displayItems }: { displayItems: string[] }) {
  const pathname = usePathname();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!displayItems || displayItems.length <= 1) return;

    let interval: ReturnType<typeof setInterval>;

    const start = () => {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % displayItems.length);
      }, 4000);
    };
    const stop = () => clearInterval(interval);

    const onVisibility = () => {
      if (document.hidden) stop(); else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [displayItems]);

  // Hide announcement bar on all admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  if (!displayItems || displayItems.length === 0) return null;

  return (
    <div className="sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk sm:h-7">
      
      {/* MOBILE: Fade Carousel */}
      <div className="relative flex w-full max-w-2xl items-center justify-center h-full md:hidden">
        {displayItems.map((text, i) => (
          <div
            key={i}
            className={`absolute w-full text-center transition-opacity duration-500 ease-in-out px-4 truncate ${
              i === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {text}
          </div>
        ))}
      </div>

      {/* DESKTOP: Inline List */}
      <div className="hidden md:flex items-center">
        {displayItems.map((text, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && (
              <span className="mx-3 shrink-0 text-sunlit-clay" aria-hidden="true">
                ·
              </span>
            )}
            <span className="block truncate max-w-none">{text}</span>
          </span>
        ))}
      </div>

    </div>
  );
}

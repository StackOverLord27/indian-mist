"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

// ─── Announcement data ───────────────────────────────────────────────────────

const announcements = [
  "Free shipping on orders above ₹999",
  "1 tree planted with every order",
  "100% eco-friendly packaging",
  "Easy 30-day returns",
];

// ─── Desktop: all announcements inline, separated by dots ────────────────────

function DesktopAnnouncements() {
  return (
    <div className="flex items-center">
      {announcements.map((text, i) => (
        <span key={text} className="flex items-center">
          {i > 0 && (
            <span className="mx-3 shrink-0 text-sunlit-clay" aria-hidden="true">
              ·
            </span>
          )}
          <span>{text}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Mobile: auto-rotating Embla carousel ────────────────────────────────────

function MobileCarousel() {
  const autoplay = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [emblaRef] = useEmblaCarousel(
    { loop: true, duration: 25, align: "center" },
    [autoplay.current]
  );

  return (
    <div
      ref={emblaRef}
      className="w-full overflow-hidden"
      aria-live="polite"
      aria-label="Announcements"
    >
      <div className="flex">
        {announcements.map((text, i) => (
          <div
            key={text}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${announcements.length}`}
            className="min-w-0 shrink-0 grow-0 basis-full text-center"
          >
            <span className="block truncate px-2">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <div className="sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk sm:h-7">
      {/* Mobile: rotating carousel — hidden at md+ */}
      <div className="flex w-full items-center justify-center md:hidden">
        <MobileCarousel />
      </div>

      {/* Desktop: all announcements inline — hidden below md */}
      <div className="hidden md:flex">
        <DesktopAnnouncements />
      </div>
    </div>
  );
}

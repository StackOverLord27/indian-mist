"use client";

import { usePathname } from "next/navigation";

export function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <div className="sticky top-0 z-50 flex h-7 w-full items-center justify-center bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk">
      <span>Free shipping on orders above ₹999</span>
      <span className="mx-3 text-sunlit-clay" aria-hidden="true">
        ·
      </span>
      <span>1 tree planted with every order</span>
    </div>
  );
}

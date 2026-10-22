"use client";

import { useEffect, useState } from "react";
import { Ruler, X } from "lucide-react";

export function SizeChartModal({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 font-montserrat text-xs font-medium text-olive underline underline-offset-4 hover:text-forest transition-colors cursor-pointer"
      >
        <Ruler className="size-3.5" />
        Size chart
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Size chart"
        >
          <div
            className="relative max-h-full max-w-3xl overflow-auto rounded-md bg-cornsilk p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full bg-forest/80 p-1.5 text-cornsilk hover:bg-forest cursor-pointer"
              aria-label="Close size chart"
            >
              <X className="size-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Size chart" className="h-auto w-full" />
          </div>
        </div>
      )}
    </>
  );
}

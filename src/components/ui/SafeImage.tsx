"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

/**
 * A product/order image that never leaves a broken-image icon behind.
 * Orders and carts keep the image address they were created with; if that file is deleted later
 * (the admin replaced or removed the photo) the image fails to load and a neutral placeholder is
 * shown in the same box, so the layout does not change. When `fallbackSrc` is given (the
 * product's CURRENT photo) it is tried before the placeholder.
 * Use inside a positioned parent, like `next/image` with `fill`.
 */
export function SafeImage({
  src,
  alt,
  className,
  sizes,
  fallback,
  fallbackSrc,
}: {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  fallback?: ReactNode;
}) {
  // Remember which addresses failed, so a different address (a changed cart line) is tried again
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [src, fallbackSrc].filter((s): s is string => !!s && !failed.includes(s));
  const current = candidates[0];

  if (!current) {
    return (
      <>
        {fallback ?? (
          <div
            role="img"
            aria-label={alt}
            className="absolute inset-0 flex items-center justify-center bg-olive/10 font-montserrat text-xs text-olive/40"
          >
            IM
          </div>
        )}
      </>
    );
  }

  return (
    <Image
      src={current}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      onError={() => setFailed((list) => [...list, current])}
    />
  );
}

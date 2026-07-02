import Image from "next/image";

import { cn } from "@/lib/utils";
import type { HomeImage } from "@/lib/homepage-data";

const BLUR_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23606c38'/%3E%3Ccircle cx='6' cy='2' r='4' fill='%23dda15e' fill-opacity='.45'/%3E%3C/svg%3E";

type ImageSlotProps = {
  image: HomeImage;
  sizes?: string;
  preload?: boolean;
  className?: string;
  imageClassName?: string;
};

export function ImageSlot({
  image,
  sizes = "100vw",
  preload = false,
  className,
  imageClassName,
}: ImageSlotProps) {
  return (
    <div
      className={cn("absolute inset-0", image.fallbackClassName, className)}
      role={image.src ? undefined : "img"}
      aria-label={image.src ? undefined : image.alt}
    >
      {image.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          preload={preload}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className={cn("object-cover", imageClassName)}
        />
      ) : null}
    </div>
  );
}

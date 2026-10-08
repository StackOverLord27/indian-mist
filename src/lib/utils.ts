import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as Indian Rupee currency (₹1,234) */
export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

/** Older saved carts and wishlists stored the image as { url } instead of a plain string. */
export function getImageSrc(image: string | { url?: string } | null | undefined): string {
  if (typeof image === "string") return image;
  return image?.url ?? "";
}

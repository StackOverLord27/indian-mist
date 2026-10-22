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

// Hosts next/image is allowed to load from (same list as images.remotePatterns in next.config.ts)
const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com", "images.unsplash.com"];

/**
 * Older saved carts and wishlists stored the image as { url } instead of a plain string.
 * Returns "" for anything next/image would reject (not a URL, or an unlisted host): a bad saved
 * value must show a placeholder, not crash the whole bag page.
 */
export function getImageSrc(image: string | { url?: string } | null | undefined): string {
  const src = typeof image === "string" ? image : (image?.url ?? "");
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.includes(url.hostname) ? src : "";
  } catch {
    return "";
  }
}

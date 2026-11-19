import type { Metadata } from "next";

export const SITE_NAME = "Indian Mist";

/** A description for search results: plain text, one line, at most `max` characters. */
export function summarise(text: string | undefined | null, max = 160): string | undefined {
  const plain = (text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return undefined;
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The metadata every public page shares: title (the root layout adds " | Indian Mist"), canonical
 * address, and Open Graph / Twitter data. `path` is the page's own path ("/products/olive-tee");
 * the root layout's metadataBase turns it into a full address.
 *
 * Next.js replaces whole top-level groups (openGraph, twitter) when a page sets them, instead of
 * merging, so each page has to carry siteName, locale etc. itself: that is why this helper exists.
 */
export function pageMetadata(opts: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
}): Metadata {
  const images = opts.image ? [{ url: opts.image }] : undefined;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: opts.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_IN",
      url: opts.path,
      title: opts.title,
      description: opts.description,
      images,
      ...(opts.publishedTime && { publishedTime: opts.publishedTime }),
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.title,
      description: opts.description,
      images: opts.image ? [opts.image] : undefined,
    },
  };
}

/** Pages that must not appear in search results. */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/** Product (schema.org) structured data for a product page. Prices are in INR; availability follows real stock. */
export function productJsonLd(p: {
  name: string;
  slug: string;
  description?: string;
  price: number;
  images: string[];
  inStock: boolean;
  siteUrl: string;
  color?: string;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url: `${p.siteUrl}/products/${p.slug}`,
    sku: p.slug,
    ...(summarise(p.description, 500) && { description: summarise(p.description, 500) }),
    ...(p.images.length > 0 && { image: p.images }),
    ...(p.color && { color: p.color }),
    ...(p.category && { category: p.category }),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${p.siteUrl}/products/${p.slug}`,
      priceCurrency: "INR",
      price: p.price.toFixed(2),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so no text can close the tag early. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Whether a product can be bought at all, from the same data the page uses. */
export function productInStock(p: {
  badge?: string;
  stock?: number;
  stockBySize?: Record<string, number>;
}): boolean {
  if (p.badge === "Sold Out") return false;
  if (p.stockBySize) return Object.values(p.stockBySize).some((q) => q > 0);
  if (p.stock !== undefined) return p.stock > 0;
  return true; // stock is not tracked for this product
}

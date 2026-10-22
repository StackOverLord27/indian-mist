import type { Product, ProductBadge } from "@/lib/homepage-data";

export type PopulatedProduct = {
  _id: { toString(): string };
  slug?: string;
  name: string;
  category: string;
  price: number;
  badge?: ProductBadge | "";
  sizes?: string[];
  images?: { url?: string; alt?: string }[];
};

export type PopulatedCollection = {
  _id: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  products?: (PopulatedProduct | null)[];
};

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export function toCardProduct(p: PopulatedProduct): Product {
  return {
    id: p.slug || p._id.toString(),
    productId: p._id.toString(),
    name: p.name,
    category: p.category,
    price: formatPrice(p.price),
    badge: p.badge || undefined,
    sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
    image: {
      src: p.images?.[0]?.url || undefined,
      alt: p.images?.[0]?.alt || p.name,
      fallbackClassName: "bg-olive-leaf/20",
    },
  };
}

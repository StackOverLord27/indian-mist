 
// Old mock products and types removed
import dbConnect from "@/lib/db";
import { Product as ProductModel } from "@/models/product.model";

export type Product = {
  id: string
  slug: string
  name: string
  category: string
  price: number
  originalPrice?: number
  badge?: 'New' | 'Sale' | 'Sold Out'
  description: string
  features: string[]
  images: string[]
  sizes?: string[]
  availableSizes?: string[]
  /** Units left per size, only when stock is tracked per size */
  stockBySize?: Record<string, number>
  /** Units left for the whole product, only when stock is tracked without sizes */
  stock?: number
  color?: { name: string; hex: string }
  colorVariants: { slug: string; name: string; hex: string; soldOut: boolean }[]
  materials: string[]
  careInstructions: { text: string; icon: string }[]
  tags: string[]
  relatedProductIds: string[]
  shippingInfo: {
    standard: string
    express: string
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await dbConnect();
  
  const p = await ProductModel.findOne({ slug })
    .select("slug name category price originalPrice badge description images sizes trackInventory stockQuantity sizeStock colorName colorHex colorGroup materials careInstructions tags features shippingInfo")
    .lean();
  if (!p) return null;

  const hasColor = !!p.colorName && !!p.colorHex;
  const siblings = hasColor && p.colorGroup
    ? await ProductModel.find({ colorGroup: p.colorGroup, colorName: { $ne: "" }, colorHex: { $ne: "" } })
        .select("slug colorName colorHex badge")
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const perSize = !!p.trackInventory && !!p.sizeStock?.length;
  const stockBySize = perSize ? Object.fromEntries(p.sizeStock!.map((s) => [s.size, s.quantity])) : undefined;

  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    originalPrice: p.originalPrice,
    badge: (p.badge === "" ? undefined : p.badge) as "New" | "Sale" | "Sold Out" | undefined,
    description: p.description,
    features: p.features || [],
    images: (p.images || []).map((img) => img.url),
    sizes: p.sizes || [],
    availableSizes: stockBySize ? (p.sizes || []).filter((s) => (stockBySize[s] ?? 0) > 0) : p.sizes || [],
    stockBySize,
    stock: p.trackInventory && !perSize ? p.stockQuantity ?? 0 : undefined,
    color: hasColor ? { name: p.colorName as string, hex: p.colorHex as string } : undefined,
    colorVariants: siblings.map((s) => ({
      slug: s.slug,
      name: s.colorName as string,
      hex: s.colorHex as string,
      soldOut: s.badge === "Sold Out",
    })),
    materials: p.materials || [],
    // Older products stored care instructions as plain strings
    careInstructions: ((p.careInstructions ?? []) as unknown as (string | { text: string; icon?: string })[]).map((c) =>
      typeof c === "string" ? { text: c, icon: "droplets" } : { text: c.text, icon: c.icon || "droplets" }
    ),
    tags: p.tags || [],
    relatedProductIds: [],
    shippingInfo: {
      standard: p.shippingInfo?.standard || "3-5 business days",
      express: p.shippingInfo?.express || "1-2 business days",
    }
  };
}

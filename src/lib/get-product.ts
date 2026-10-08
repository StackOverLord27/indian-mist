 
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
  colors?: { name: string; hex: string }[]
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
    .select("slug name category price originalPrice badge description images sizes colors materials careInstructions tags features shippingInfo")
    .lean();
  if (!p) return null;

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
    images: (p.images || []).map((img: any) => img.url),
    sizes: p.sizes || [],
    availableSizes: p.sizes || [],
    colors: (p.colors || []).map((c: string) => ({ name: c, hex: "#000" })),
    materials: p.materials || [],
    careInstructions: ((p as any).careInstructions || []).map((c: any) =>
      typeof c === "string" ? { text: c, icon: "droplets" } : { text: c.text, icon: c.icon || "droplets" }
    ),
    tags: p.tags || [],
    relatedProductIds: [],
    shippingInfo: {
      standard: (p as any).shippingInfo?.standard || "3-5 business days",
      express: (p as any).shippingInfo?.express || "1-2 business days",
    }
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  rating: number
  reviewCount: number
  badge?: 'New' | 'Sale' | 'Sold Out'
  description: string
  features: string[]
  images: string[]
  sizes?: string[]
  availableSizes?: string[]
  colors?: { name: string; hex: string }[]
  materials: { name: string; percentage: number; origin: string }[]
  careInstructions: string[]
  tags: string[]
  relatedProductIds: string[]
  shippingInfo: {
    standard: string
    express: string
    free: boolean
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await dbConnect();
  
  const p = await ProductModel.findOne({ slug })
    .select("slug name category price originalPrice badge description images sizes colors")
    .lean();
  if (!p) return null;

  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    originalPrice: p.originalPrice,
    rating: 0,
    reviewCount: 0,
    badge: (p.badge === "" ? undefined : p.badge) as "New" | "Sale" | "Sold Out" | undefined,
    description: p.description,
    features: [],
    images: (p.images || []).map((img: any) => img.url),
    sizes: p.sizes || [],
    availableSizes: p.sizes || [],
    colors: (p.colors || []).map((c: string) => ({ name: c, hex: "#000" })),
    materials: [],
    careInstructions: [],
    tags: [],
    relatedProductIds: [],
    shippingInfo: {
      standard: "3-5 business days",
      express: "1-2 business days",
      free: false
    }
  };
}

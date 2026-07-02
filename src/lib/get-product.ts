export type Product = {
  id: string
  slug: string
  name: string
  category: string
  price: number
  originalPrice?: number
  rating: number
  reviewCount: number
  badge?: 'New' | 'Sale'
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

export const mockProducts: Product[] = [
  {
    id: "trailpack-canvas",
    slug: "trailpack-canvas",
    name: "Trailpack Canvas 22L",
    category: "Forest gear",
    price: 2499,
    originalPrice: 2999,
    rating: 4.8,
    reviewCount: 42,
    badge: "New",
    description: "Built for dense trails and sudden downpours. The Trailpack Canvas 22L uses densely woven, plant-dyed canvas that naturally repels water and ages beautifully with every expedition. Features an expandable roll-top, padded internal sleeve, and reinforced base.",
    features: [
      "Water-resistant wax-treated canvas",
      "Expandable roll-top closure",
      "Padded back panel and ergonomic straps",
      "Internal 15-inch laptop sleeve"
    ],
    images: [
      "https://images.unsplash.com/photo-1622260614153-03223fb72052?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=1000&auto=format&fit=crop"
    ],
    sizes: ["One Size"],
    availableSizes: ["One Size"],
    colors: [
      { name: "Olive", hex: "#606c38" },
      { name: "Forest", hex: "#283618" }
    ],
    materials: [
      { name: "Organic Canvas", percentage: 80, origin: "India" },
      { name: "Recycled Polyester", percentage: 20, origin: "Taiwan" }
    ],
    careInstructions: [
      "Spot clean with mild soap and cold water",
      "Air dry in shade",
      "Re-wax every year for water resistance"
    ],
    tags: ["Durable", "Water-resistant", "Travel"],
    relatedProductIds: ["organic-field-tee", "copper-leaf-pin", "recycled-journal"],
    shippingInfo: {
      standard: "3-5 business days",
      express: "1-2 business days",
      free: true
    }
  },
  {
    id: "organic-field-tee",
    slug: "organic-field-tee",
    name: "Organic Field Tee",
    category: "Apparel",
    price: 899,
    originalPrice: 1299,
    rating: 4.5,
    reviewCount: 128,
    badge: "Sale",
    description: "An incredibly soft, breathable field tee made entirely from rain-fed organic cotton. Dyed using natural earth pigments, ensuring no harsh chemicals ever touch your skin or local waterways.",
    features: [
      "100% GOTS certified organic cotton",
      "Naturally dyed",
      "Pre-washed to prevent shrinkage",
      "Relaxed fit for mobility"
    ],
    images: [
      "https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=1000&auto=format&fit=crop"
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    availableSizes: ["S", "M", "L"],
    colors: [
      { name: "Clay", hex: "#dda15e" },
      { name: "Cornsilk", hex: "#fefae0" }
    ],
    materials: [
      { name: "Organic Cotton", percentage: 100, origin: "India" }
    ],
    careInstructions: [
      "Machine wash cold with like colors",
      "Tumble dry low or line dry",
      "Do not bleach"
    ],
    tags: ["Organic", "Apparel", "Breathable"],
    relatedProductIds: ["trailpack-canvas", "mist-shell-jacket", "rootline-daypack"],
    shippingInfo: {
      standard: "3-5 business days",
      express: "1-2 business days",
      free: false
    }
  }
]

export async function getProductBySlug(slug: string): Promise<Product | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))
  const product = mockProducts.find(p => p.slug === slug)
  return product || null
}

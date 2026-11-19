import { BrandStorySection } from "@/components/home/BrandStorySection";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EcoCommitmentSection } from "@/components/home/EcoCommitmentSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsletterBar } from "@/components/home/NewsletterBar";
import { NewestArrivals } from "@/components/home/NewestArrivals";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import {
  heroImage,
  storyImage,
  Product as UIProduct,
  type ProductBadge,
  Arrival as UIArrival,
  Category as UICategory,
} from "@/lib/homepage-data";
import dbConnect from "@/lib/db";
import { Product } from "@/models/product.model";
import { Category as CategoryModel } from "@/models/category.model";
import { getSiteSettings, getCategoryNames, getCategoryCounts } from "@/lib/storefront-data";
import { categoryLabel } from "@/lib/category-labels";
import CarouselModel from "@/models/carousel.model";
import { CarouselImage, SiteSettings } from "@/types/admin";
import type { Metadata } from "next";

// Same page whichever way it was reached (www, tracking parameters...)
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const revalidate = 60;

/**
 * The most featured products the home page shows. The section loads 8 at a time as you scroll
 * (FeaturedProducts), so 24 is three batches; "View all" leads to the full catalogue.
 */
const FEATURED_LIMIT = 24;

type ProductDoc = {
  _id?: string;
  slug: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  badge?: ProductBadge;
  sizes?: string[];
  images?: { url?: string }[];
};

type CategoryDoc = {
  slug: string;
  name: string;
  count: number;
  isFeatured?: boolean;
  image?: { url?: string; alt?: string };
};

type CarouselDoc = {
  _id: string;
  url: string;
  alt?: string;
  altText?: string;
  publicId?: string;
  order?: number;
  isActive?: boolean;
};

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export default async function Home() {
  await dbConnect();

  // ─── Parallel aggregation pipelines ──────────────────────────────────────
  // Run all three queries in parallel for optimal latency.

  const results = await Promise.all([
    // 1. Featured products: products marked with isFeatured
    Product.find({ isFeatured: true })
      .sort({ createdAt: -1, _id: 1 })
      .limit(FEATURED_LIMIT)
      .select("slug name category price badge images sizes")
      .lean(),

    // 2. Newest arrivals: all products with description
    Product.find({})
      .sort({ createdAt: -1 })
      .limit(24)
      .select("slug name category description price badge images sizes")
      .lean(),

    // 3. The categories themselves (a small collection)
    CategoryModel.find({ isHidden: { $ne: true } })
      .sort({ isFeatured: -1, createdAt: -1 })
      .select("name slug image isFeatured")
      .lean(),

    // 3b. How many products each category has (one grouped count, see getCategoryCounts)
    getCategoryCounts(),

    // 3c. Real category names, for the labels on the product cards
    getCategoryNames(),

    // 4. Site settings for hero and branding
    getSiteSettings(),

    // 5. Active carousel images
    CarouselModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean(),
  ]);

  const [featuredDocs, arrivalDocs, categoryRows, categoryCounts, categoryNames, settingsDoc, carouselDocs] = JSON.parse(
    JSON.stringify(results),
  ) as [ProductDoc[], ProductDoc[], Omit<CategoryDoc, "count">[], Record<string, number>, Record<string, string>, SiteSettings | null, CarouselDoc[]];

  // ─── Map DB results to UI types (no placeholder fallback)

  const categoryDocs: CategoryDoc[] = categoryRows.map((c) => ({ ...c, count: categoryCounts[c.slug] ?? 0 }));

  let mappedFeatured: UIProduct[] = [];
  let mappedArrivals: UIArrival[] = [];
  let mappedCategories: UICategory[] = [];

  if (featuredDocs.length > 0) {
    mappedFeatured = featuredDocs.map((p) => ({
      id: p.slug,
      productId: p._id,
      name: p.name,
      category: categoryLabel(categoryNames, p.category),
      price: formatPrice(p.price),
      badge: p.badge,
      sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
      image: {
        src: p.images?.[0]?.url || undefined,
        alt: p.name,
        fallbackClassName: "bg-olive-leaf/20",
      },
    }));
  }

  if (arrivalDocs.length > 0) {
    mappedArrivals = arrivalDocs.map((p) => ({
      id: p.slug,
      productId: p._id,
      name: p.name,
      category: categoryLabel(categoryNames, p.category),
      description: p.description ?? "",
      price: formatPrice(p.price),
      badge: p.badge,
      sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
      image: {
        src: p.images?.[0]?.url || undefined,
        alt: p.name,
        fallbackClassName: "bg-olive-leaf/25",
      },
    }));
  }

  if (categoryDocs.length > 0) {
    mappedCategories = categoryDocs.map((cat) => ({
      id: cat.slug,
      name: cat.name,
      productCount: `${cat.count} product${cat.count !== 1 ? "s" : ""}`,
      featured: cat.isFeatured,
      image: {
        src: cat.image?.url || undefined,
        alt: cat.image?.alt || `${cat.name} category`,
        fallbackClassName: "bg-black-forest/25",
      },
    }));
  }

  const mappedSlides: CarouselImage[] = (carouselDocs || []).map((c) => ({
    _id: c._id.toString(),
    url: c.url,
    alt: c.alt || c.altText || "",
    altText: c.alt || c.altText || "",
    publicId: c.publicId || "",
    order: c.order || 0,
    isActive: c.isActive !== false,
  }));

  return (
    <div className="w-full bg-cornsilk">
      <HeroSection
        settings={settingsDoc?.heroSettings}
        slides={mappedSlides}
        fallbackImage={heroImage}
      />
      <TrustStrip items={settingsDoc?.trustStripSettings?.items} />
      <ScrollReveal>
        <FeaturedProducts products={mappedFeatured} />
      </ScrollReveal>
      <ScrollReveal>
        <BrandStorySection
          image={storyImage}
          settings={settingsDoc?.brandStorySettings}
        />
      </ScrollReveal>
      <ScrollReveal>
        <CategoryGrid categories={mappedCategories} />
      </ScrollReveal>
      <ScrollReveal>
        <NewestArrivals arrivals={mappedArrivals} />
      </ScrollReveal>
      <ScrollReveal>
        <EcoCommitmentSection settings={settingsDoc?.ecoCommitmentSettings} />
      </ScrollReveal>
      <NewsletterBar />
    </div>
  );
}

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
import SiteSettingsModel from "@/models/settings.model";
import CarouselModel from "@/models/carousel.model";
import { CarouselImage, SiteSettings } from "@/types/admin";

export const revalidate = 60;

type ProductDoc = {
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
      .sort({ createdAt: -1 })
      .select("slug name category price badge images sizes")
      .lean(),

    // 2. Newest arrivals: all products with description
    Product.find({})
      .sort({ createdAt: -1 })
      .limit(24)
      .select("slug name category description price badge images sizes")
      .lean(),

    // 3. Category counts & images via actual Category collection
    CategoryModel.aggregate([
      { $match: { isHidden: { $ne: true } } },
      { $sort: { isFeatured: -1, createdAt: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "slug",
          foreignField: "category",
          as: "products"
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          isFeatured: 1,
          count: { $size: "$products" }
        }
      }
    ]),

    // 4. Site settings for hero and branding
    SiteSettingsModel.findOne().lean(),

    // 5. Active carousel images
    CarouselModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean(),
  ]);

  const [featuredDocs, arrivalDocs, categoryDocs, settingsDoc, carouselDocs] = JSON.parse(
    JSON.stringify(results),
  ) as [ProductDoc[], ProductDoc[], CategoryDoc[], SiteSettings | null, CarouselDoc[]];

  // ─── Map DB results to UI types (no placeholder fallback)

  let mappedFeatured: UIProduct[] = [];
  let mappedArrivals: UIArrival[] = [];
  let mappedCategories: UICategory[] = [];

  if (featuredDocs.length > 0) {
    mappedFeatured = featuredDocs.map((p) => ({
      id: p.slug,
      name: p.name,
      category: p.category,
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
      name: p.name,
      category: p.category,
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

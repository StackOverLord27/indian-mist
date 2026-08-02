import { BrandStorySection } from "@/components/home/BrandStorySection";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EcoCommitmentSection } from "@/components/home/EcoCommitmentSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsletterBar } from "@/components/home/NewsletterBar";
import { NewestArrivals } from "@/components/home/NewestArrivals";
import { TrustStrip } from "@/components/home/TrustStrip";
import {
  categories as defaultCategories,
  featuredProducts as defaultFeatured,
  heroImage,
  newestArrivals as defaultArrivals,
  storyImage,
  Product as UIProduct,
  Arrival as UIArrival,
  Category as UICategory,
} from "@/lib/homepage-data";
import dbConnect from "@/lib/db";
import { Product } from "@/models/Product";

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export default async function Home() {
  await dbConnect();

  // ─── Parallel aggregation pipelines ──────────────────────────────────────
  // Run all three queries in parallel for optimal latency.

  const [featuredDocs, arrivalDocs, categoryDocs] = await Promise.all([
    // 1. Featured products: all products with only the fields we need
    Product.find({})
      .sort({ createdAt: -1 })
      .select("slug name category price badge images")
      .lean(),

    // 2. Newest arrivals: all products with description
    Product.find({})
      .sort({ createdAt: -1 })
      .select("slug name category description price images")
      .lean(),

    // 3. Category counts & images via aggregation pipeline
    //    Groups by category, counts products, picks a representative image
    //    (prefers isCategoryFeatured products), all in a single DB round-trip.
    Product.aggregate<{
      _id: string;
      count: number;
      image: string | null;
      isFeatured: boolean;
    }>([
      {
        $sort: { isCategoryFeatured: -1, createdAt: -1 },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          // $first picks the first doc per group — since we sorted by
          // isCategoryFeatured desc, featured products come first.
          image: {
            $first: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$images", []] } }, 0] },
                { $arrayElemAt: ["$images", 0] },
                null,
              ],
            },
          },
          isFeatured: { $first: { $ifNull: ["$isCategoryFeatured", false] } },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          image: 1,
          isFeatured: 1,
        },
      },
    ]),
  ]);

  // ─── Map DB results to UI types (fallback to static data if DB is empty)

  let mappedFeatured: UIProduct[] = defaultFeatured;
  let mappedArrivals: UIArrival[] = defaultArrivals;
  let mappedCategories: UICategory[] = defaultCategories;

  if (featuredDocs.length > 0) {
    mappedFeatured = featuredDocs.map((p: any) => ({
      id: p.slug,
      name: p.name,
      category: p.category,
      price: formatPrice(p.price),
      badge: p.badge,
      image: {
        src: p.images?.[0] ?? undefined,
        alt: p.name,
        fallbackClassName: "bg-olive-leaf/20",
      },
    }));
  }

  if (arrivalDocs.length > 0) {
    mappedArrivals = arrivalDocs.map((p: any) => ({
      id: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      price: formatPrice(p.price),
      image: {
        src: p.images?.[0] ?? undefined,
        alt: p.name,
        fallbackClassName: "bg-olive-leaf/25",
      },
    }));
  }

  if (categoryDocs.length > 0) {
    mappedCategories = categoryDocs.map((cat) => ({
      id: cat._id.toLowerCase().replace(/\s+/g, "-"),
      name: cat._id,
      productCount: `${cat.count} product${cat.count !== 1 ? "s" : ""}`,
      featured: cat.isFeatured,
      image: {
        src: cat.image ?? undefined,
        alt: `${cat._id} category`,
        fallbackClassName: "bg-black-forest/25",
      },
    }));
  }

  return (
    <div className="w-full bg-cornsilk">
      <HeroSection image={heroImage} />
      <TrustStrip />
      <FeaturedProducts products={mappedFeatured} />
      <BrandStorySection image={storyImage} />
      <CategoryGrid categories={mappedCategories.length > 0 ? mappedCategories : defaultCategories} />
      <NewestArrivals arrivals={mappedArrivals} />
      <EcoCommitmentSection />
      <NewsletterBar />
    </div>
  );
}

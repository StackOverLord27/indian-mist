import { BrandStorySection } from "@/components/home/BrandStorySection";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EcoCommitmentSection } from "@/components/home/EcoCommitmentSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsletterBar } from "@/components/home/NewsletterBar";
import { NewestArrivals } from "@/components/home/NewestArrivals";
import { TrustStrip } from "@/components/home/TrustStrip";
import {
  categories,
  featuredProducts,
  heroImage,
  newestArrivals,
  storyImage,
} from "@/lib/homepage-data";

export default function Home() {
  return (
    <div className="w-full bg-cornsilk">
      <HeroSection image={heroImage} />
      <TrustStrip />
      <FeaturedProducts products={featuredProducts} />
      <BrandStorySection image={storyImage} />
      <CategoryGrid categories={categories} />
      <NewestArrivals arrivals={newestArrivals} />
      <EcoCommitmentSection />
      <NewsletterBar />
    </div>
  );
}

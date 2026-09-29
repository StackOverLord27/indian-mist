import Link from "next/link";
import { Leaf } from "lucide-react";
import { HeroCarouselClient } from "@/components/home/HeroCarouselClient";
import type { HeroSettings, CarouselImage } from "@/types/admin";
import type { HomeImage } from "@/lib/homepage-data";

type HeroSectionProps = {
  settings?: HeroSettings;
  slides?: CarouselImage[];
  fallbackImage?: HomeImage;
};

export function HeroSection({ settings, slides = [], fallbackImage }: HeroSectionProps) {
  const subtitle = settings?.subtitle || "Summer 2026 Collection";
  const titleLine1 = settings?.titleLine1 || "Born from the forest,";
  const titleLine2 = settings?.titleLine2 || "made for the wild.";
  const description = settings?.description || "Slow-made forest gear, apparel, and everyday eco goods for trails, travel, and the rituals that bring you back outside.";
  const primaryButtonText = settings?.primaryButtonText || "Shop the collection →";
  const primaryButtonLink = settings?.primaryButtonLink || "/products";
  const secondaryButtonText = settings?.secondaryButtonText || "Our story";
  const secondaryButtonLink = settings?.secondaryButtonLink || "/about";

  const isEcoBadgeVisible = settings?.ecoBadge?.isVisible !== false;
  const ecoBadgeText = settings?.ecoBadge?.text || "100%";
  const ecoBadgeSubtext = settings?.ecoBadge?.subtext || "Eco materials";

  const theme = settings?.theme || 'forest';

  const themeStyles = {
    // Deep dark green — the signature look
    forest: {
      bg: 'bg-black-forest',
      subtitle: 'text-sunlit-clay before:bg-sunlit-clay',
      title: 'text-cornsilk',
      accent: 'text-sunlit-clay',
      description: 'text-cornsilk/65',
      primaryBtn: 'bg-sunlit-clay text-black-forest hover:bg-copperwood',
      secondaryBtn: 'border-cornsilk/60 text-cornsilk hover:border-cornsilk',
    },
    // Near-black charcoal — moody, editorial
    midnight: {
      bg: 'bg-stone-900',
      subtitle: 'text-amber-400 before:bg-amber-400',
      title: 'text-stone-50',
      accent: 'text-amber-400',
      description: 'text-stone-300',
      primaryBtn: 'bg-amber-400 text-stone-900 hover:bg-amber-500',
      secondaryBtn: 'border-stone-400 text-stone-200 hover:border-stone-200',
    },
    // Deep terracotta/copper — warm, earthy, rich contrast
    sunlit: {
      bg: 'bg-copperwood',
      subtitle: 'text-cornsilk before:bg-cornsilk',
      title: 'text-cornsilk',
      accent: 'text-warm-mist',
      description: 'text-cornsilk/70',
      primaryBtn: 'bg-cornsilk text-copperwood hover:bg-warm-mist',
      secondaryBtn: 'border-cornsilk/60 text-cornsilk hover:border-cornsilk',
    }
  };

  const currentTheme = themeStyles[theme] || themeStyles.forest;

  const activeSlides = slides.filter(s => s.isActive !== false);

  const effectiveSlides: CarouselImage[] = activeSlides;

  return (
    <section className="grid min-h-120 w-full grid-cols-1 lg:grid-cols-2">
      {/* Text panel */}
      <div className={`flex min-h-[min(60vw,30rem)] flex-col justify-center px-6 py-12 md:min-h-120 md:px-12 transition-colors duration-500 ${currentTheme.bg}`}>
        <p className={`flex items-center gap-4 font-sans text-2xs font-medium uppercase tracking-widest before:block before:h-px before:w-7 before:content-[''] ${currentTheme.subtitle}`}>
          {subtitle}
        </p>
        <h1 className={`mt-7 max-w-xl font-serif text-3xl font-light leading-tight md:text-hero ${currentTheme.title}`}>
          {titleLine1}
          <br />
          <em className={`font-light italic ${currentTheme.accent}`}>
            {titleLine2}
          </em>
        </h1>
        <p className={`mt-6 max-w-md font-sans text-sm font-light leading-6 ${currentTheme.description}`}>
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryButtonLink}
            className={`inline-flex h-11 items-center justify-center rounded-full px-6 font-sans text-xs font-medium uppercase tracking-wide transition-opacity hover:opacity-85 ${currentTheme.primaryBtn}`}
          >
            {primaryButtonText}
          </Link>
          <Link
            href={secondaryButtonLink}
            className={`inline-flex h-11 items-center justify-center rounded-full border px-6 font-sans text-xs font-medium uppercase tracking-wide transition-opacity hover:opacity-75 ${currentTheme.secondaryBtn}`}
          >
            {secondaryButtonText}
          </Link>
        </div>
      </div>

      {/* Carousel panel */}
      <div
        className="relative min-h-[min(75vw,30rem)] overflow-hidden bg-olive-leaf lg:min-h-120"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 18%, rgba(254, 250, 224, 0.18), transparent 34%), radial-gradient(circle at 75% 80%, rgba(221, 161, 94, 0.18), transparent 30%)",
        }}
      >
        <HeroCarouselClient 
          slides={effectiveSlides} 
          className="w-full h-full relative group"
          itemClassName="relative w-full h-full min-h-[min(75vw,30rem)] lg:min-h-120 overflow-hidden"
        />

        {/* Eco badge — compact on mobile */}
        {isEcoBadgeVisible && (
          <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 rounded-home-card bg-cornsilk p-3 text-black-forest sm:p-4 shadow-md pointer-events-none">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warm-mist text-olive-leaf sm:size-10">
              <Leaf className="size-4 sm:size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-serif text-2xl font-bold leading-none text-olive-leaf sm:text-3xl">
                {ecoBadgeText}
              </p>
              <p className="mt-1 font-sans text-2xs font-medium uppercase tracking-widest text-black-forest/70">
                {ecoBadgeSubtext}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

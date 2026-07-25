import Link from "next/link";
import { Leaf } from "lucide-react";

import { ImageSlot } from "@/components/home/ImageSlot";
import type { HomeImage } from "@/lib/homepage-data";

type HeroSectionProps = {
  image: HomeImage;
};

export function HeroSection({ image }: HeroSectionProps) {
  return (
    <section className="grid min-h-120 w-full grid-cols-1 lg:grid-cols-2">
      {/* Text panel */}
      <div className="flex min-h-[min(60vw,30rem)] flex-col justify-center bg-black-forest px-6 py-12 md:min-h-120 md:px-12">
        <p className="flex items-center gap-4 font-sans text-2xs font-medium uppercase tracking-widest text-sunlit-clay before:block before:h-px before:w-7 before:bg-sunlit-clay before:content-['']">
          Summer 2026 Collection
        </p>
        <h1 className="mt-7 max-w-xl font-serif text-3xl font-light leading-tight text-cornsilk md:text-hero">
          Born from the forest,
          <br />
          <em className="font-light italic text-sunlit-clay">
            made for the wild.
          </em>
        </h1>
        <p className="mt-6 max-w-md font-sans text-sm font-light leading-6 text-cornsilk/60">
          Slow-made forest gear, apparel, and everyday eco goods for trails,
          travel, and the rituals that bring you back outside.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex h-11 items-center justify-center rounded-full bg-sunlit-clay px-6 font-sans text-xs font-medium uppercase tracking-wide text-black-forest transition-opacity hover:opacity-85"
          >
            Shop the collection →
          </Link>
          <Link
            href="/about"
            className="inline-flex h-11 items-center justify-center rounded-full border border-cornsilk px-6 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity hover:opacity-75"
          >
            Our story
          </Link>
        </div>
      </div>

      {/* Image panel */}
      <div
        className="relative min-h-[min(75vw,30rem)] overflow-hidden bg-olive-leaf lg:min-h-120"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 18%, rgba(254, 250, 224, 0.18), transparent 34%), radial-gradient(circle at 75% 80%, rgba(221, 161, 94, 0.18), transparent 30%)",
        }}
      >
        <ImageSlot
          image={image}
          preload
          sizes="(max-width: 1024px) 100vw, 50vw"
          imageClassName="object-cover"
        />
        {/* Eco badge — compact on mobile */}
        <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-home-card bg-cornsilk p-3 text-black-forest sm:p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warm-mist text-olive-leaf sm:size-10">
            <Leaf className="size-4 sm:size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold leading-none text-olive-leaf sm:text-3xl">
              100%
            </p>
            <p className="mt-1 font-sans text-2xs font-medium uppercase tracking-widest text-black-forest/70">
              Eco materials
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

import { ImageSlot } from "@/components/home/ImageSlot";
import type { HomeImage } from "@/lib/homepage-data";

import { BrandStorySettings } from "@/types/admin";

type BrandStorySectionProps = {
  image: HomeImage;
  settings?: BrandStorySettings;
};

export function BrandStorySection({ image, settings }: BrandStorySectionProps) {
  const subtitle = settings?.subtitle || "OUR ROOTS";
  const titleLine1 = settings?.titleLine1 || "We make things the forest would ";
  const titleLine2 = settings?.titleLine2 || "keep.";
  const description = settings?.description || "Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.";
  const buttonText = settings?.buttonText || "Read our story";
  const buttonLink = settings?.buttonLink || "/about";
  const customImageUrl = settings?.imageUrl;
  
  const tagsList = settings?.tags 
    ? settings.tags.split(',').map(t => t.trim()).filter(Boolean)
    : ["Organic cotton", "Natural dyes", "Zero plastic", "Fair trade"];

  const displayImage: HomeImage = customImageUrl 
    ? { src: customImageUrl, alt: "Brand story background", fallbackClassName: image.fallbackClassName } 
    : image;

  return (
    <section className="grid w-full grid-cols-1 lg:grid-cols-2">
      <div className="relative aspect-3/2 overflow-hidden bg-olive-leaf lg:aspect-auto lg:min-h-[33.34vw]">
        <ImageSlot image={displayImage} sizes="(max-width: 1024px) 100vw, 50vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black-forest/75 to-black-forest/10" />
      </div>

      <div className="bg-warm-mist px-6 py-14 md:px-13 lg:flex lg:flex-col lg:items-start lg:justify-center lg:px-14">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-copperwood">
          {subtitle}
        </p>
        <h2 className="mt-4 max-w-lg font-serif text-3xl font-light leading-tight text-black-forest">
          {titleLine1}
          {titleLine2 && <em className="font-light italic text-olive-leaf">{titleLine2}</em>}
        </h2>
        <p className="mt-5 max-w-xl font-sans text-sm font-light leading-6 text-black-forest/80">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {tagsList.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-olive-leaf/45 px-4 py-2 font-sans text-xs font-medium text-olive-leaf"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link
          href={buttonLink}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-olive-leaf px-6 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity hover:opacity-85"
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}

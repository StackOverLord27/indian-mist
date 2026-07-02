import Link from "next/link";

import { ImageSlot } from "@/components/home/ImageSlot";
import type { HomeImage } from "@/lib/homepage-data";

const tags = ["Organic cotton", "Natural dyes", "Zero plastic", "Fair trade"];

type BrandStorySectionProps = {
  image: HomeImage;
};

export function BrandStorySection({ image }: BrandStorySectionProps) {
  return (
    <section className="grid w-full grid-cols-1 lg:grid-cols-2">
      <div className="relative min-h-90 overflow-hidden bg-olive-leaf">
        <ImageSlot image={image} sizes="(max-width: 1024px) 100vw, 50vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black-forest/75 to-black-forest/10" />
      </div>

      <div className="bg-warm-mist px-6 py-14 md:px-13 lg:px-14">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-copperwood">
          Our roots
        </p>
        <h2 className="mt-4 max-w-lg font-serif text-3xl font-light leading-tight text-black-forest">
          We make things the forest would{" "}
          <em className="font-light italic text-olive-leaf">keep.</em>
        </h2>
        <p className="mt-5 max-w-xl font-sans text-sm font-light leading-6 text-black-forest/80">
          Indian Mist began with the simple belief that useful goods should
          leave less behind. Every pack, tee, pin, and page starts with better
          materials, durable making, and a supply chain we can explain.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-olive-leaf/45 px-4 py-2 font-sans text-xs font-medium text-olive-leaf"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link
          href="/about"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-olive-leaf px-6 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity hover:opacity-85"
        >
          Read our story
        </Link>
      </div>
    </section>
  );
}

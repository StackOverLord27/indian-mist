import { ScrollReveal } from "@/components/ui/ScrollReveal";
import Link from "next/link";
import Image from "next/image";
import { IconMap, type IconName } from "@/lib/icon-map";
import type { AboutContent, AboutImage } from "@/types/admin";
import dbConnect from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";
import About from "@/models/about.model";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import CarouselModel from "@/models/carousel.model";
import { Category as CategoryModel } from "@/models/category.model";
import { resolveAbout } from "@/lib/about-content";

export const revalidate = 60;

export default async function AboutPage() {
  let saved: Partial<AboutContent> | null = null;
  let fallbackPhotos: AboutImage[] = [];

  try {
    await dbConnect();
    const [doc, imgs, cats] = await Promise.all([
      About.findOne().lean(),
      CarouselModel.find({ isActive: true }).sort({ order: 1 }).limit(5).lean(),
      CategoryModel.find({ "image.url": { $exists: true, $ne: "" } }).limit(5).lean(),
    ]);
    saved = doc ? JSON.parse(JSON.stringify(doc)) : null;

    // Used only until photos are added in the admin gallery
    const carousel = JSON.parse(JSON.stringify(imgs)) as { url: string; publicId?: string; alt?: string; altText?: string }[];
    fallbackPhotos = carousel.map((c) => ({ url: c.url, publicId: c.publicId ?? "", alt: c.alt || c.altText || "" }));
    const seen = new Set(fallbackPhotos.map((p) => p.url));
    for (const c of JSON.parse(JSON.stringify(cats)) as { name: string; image?: { url?: string; alt?: string } }[]) {
      if (fallbackPhotos.length >= 5) break;
      if (!c.image?.url || seen.has(c.image.url)) continue;
      seen.add(c.image.url);
      fallbackPhotos.push({ url: c.image.url, publicId: "", alt: c.image.alt || c.name });
    }
  } catch (error) {
    console.error("Failed to load about content:", error);
  }

  const about = resolveAbout(saved);
  const photos = (about.gallery.images.length >= 3 ? about.gallery.images : fallbackPhotos).slice(0, 5);
  const showGallery = about.gallery.isVisible && photos.length >= 3;
  const moreSections = about.extraSections;
  const storyImage = about.story.image;
  const storyHtml = sanitizeRichText(about.story.body);

  const eyebrow = "font-montserrat text-[13px] font-semibold uppercase tracking-[0.24em]";
  const gutter = "max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16";

  return (
    <div className="bg-cornsilk min-h-screen page-enter">
      <div className={`${gutter} pt-6 pb-4`}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      </div>

      {/* Hero */}
      <section className="bg-forest text-cornsilk">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16 text-center flex flex-col items-center gap-5">
          <span className={`${eyebrow} text-clay`}>{about.hero.eyebrow}</span>
          <h1 className="font-merriweather text-3xl md:text-5xl font-normal leading-[1.15]">{about.hero.headline}</h1>
          {about.hero.lead && (
            <p className="max-w-xl font-montserrat text-base leading-relaxed text-cornsilk/75">{about.hero.lead}</p>
          )}
        </div>
      </section>

      {/* Story */}
      <ScrollReveal>
      <section className="py-16 md:py-24">
        <div className={`${gutter} grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-[72px]`}>
          <div className="relative aspect-4/5 overflow-hidden rounded-[20px] border border-[#E9D6A8] bg-warm">
            {storyImage.url ? (
              <Image
                src={storyImage.url}
                alt={storyImage.alt || about.story.heading}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <IconMap.Leaf size={40} className="text-olive/40" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-6">
            <span className={`${eyebrow} text-copper`}>{about.story.eyebrow}</span>
            <h2 className="font-merriweather text-3xl md:text-[40px] font-normal leading-tight text-forest">
              {about.story.heading}
            </h2>
            {storyHtml && (
              <div
                className="font-montserrat text-base md:text-[17px] leading-[1.8] text-muted-text [&_p+p]:mt-6 [&_a]:underline [&_strong]:text-forest [&_h2]:font-merriweather [&_h2]:text-2xl [&_h2]:text-forest [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: storyHtml }}
              />
            )}
          </div>
        </div>

        {moreSections.length > 0 && (
          <div className={`${gutter} space-y-16 md:space-y-24 mt-16 md:mt-24`}>
            {moreSections.map((section, idx) => (
              <div
                key={section._id ?? idx}
                className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-[72px] ${
                  section.imageAlignment === "right" ? "md:[&>div:first-child]:order-2" : ""
                }`}
              >
                <div className="relative aspect-4/5 overflow-hidden rounded-[20px] border border-[#E9D6A8] bg-warm">
                  {section.imageUrl ? (
                    <Image
                      src={section.imageUrl}
                      alt={section.imageAlt || section.heading}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconMap.Leaf size={40} className="text-olive/40" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-6">
                  <h2 className="font-merriweather text-3xl md:text-[40px] font-normal leading-tight text-forest">
                    {section.heading}
                  </h2>
                  <p className="font-montserrat text-base md:text-[17px] leading-[1.8] text-muted-text whitespace-pre-line">
                    {section.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </ScrollReveal>

      {/* What inspires us */}
      <ScrollReveal>
      <section className="bg-warm py-16 md:py-24">
        <div className={`${gutter} flex flex-col gap-12 md:gap-14`}>
          <div className="text-center">
            <h2 className="font-merriweather text-3xl md:text-[40px] font-normal text-forest">
              {about.values.heading}
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {about.values.cards.map((card, i) => (
              <div
                key={i}
                className="w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)] flex flex-col gap-4 rounded-[18px] border border-[#EBD9AE] bg-cornsilk px-7 py-9"
              >
                <span className="font-merriweather text-4xl leading-none text-clay">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-merriweather text-xl font-bold text-forest">{card.title}</h3>
                <p className="font-montserrat text-[15px] leading-[1.75] text-muted-text">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* In the wild: photo mosaic */}
      {showGallery && (
        <ScrollReveal>
        <section className="py-16 md:py-24">
          <div className={`${gutter} flex flex-col gap-12`}>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-3.5">
                <span className={`${eyebrow} text-copper`}>{about.gallery.eyebrow}</span>
                <h2 className="font-merriweather text-3xl md:text-[40px] font-normal text-forest">
                  {about.gallery.heading}
                </h2>
              </div>
              {about.gallery.linkLabel && (
              <Link
                href={about.gallery.linkHref}
                className="font-montserrat text-[13px] font-semibold uppercase tracking-[0.08em] text-forest border-b border-forest pb-1 hover:text-olive hover:border-olive transition-colors"
              >
                {about.gallery.linkLabel}
              </Link>
              )}
            </div>

            {/* Bento layout on desktop (one pattern per photo count); even grid on smaller screens */}
            <div className="grid grid-cols-2 gap-1 lg:grid-cols-4 lg:auto-rows-[220px] lg:grid-flow-dense">
              {photos.map((photo, i) => {
                const caption = photo.alt;
                const patterns: Record<number, string[]> = {
                  3: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "lg:col-span-2"],
                  4: ["lg:col-span-2 lg:row-span-2", "lg:row-span-2", "", ""],
                  5: ["lg:row-span-2", "lg:col-span-2", "lg:row-span-2", "", ""],
                };
                const span = patterns[photos.length]?.[i] ?? "";
                const lastOdd = photos.length % 2 === 1 && i === photos.length - 1;
                return (
                  <div
                    key={`${photo.url}-${i}`}
                    className={`relative overflow-hidden rounded-2xl bg-warm aspect-square lg:aspect-auto ${span} ${
                      lastOdd ? "max-lg:col-span-2 max-lg:aspect-[2/1]" : ""
                    }`}
                  >
                    <Image
                      src={photo.url}
                      alt={caption || "Indian Mist"}
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </ScrollReveal>
      )}

      {/* CTA */}
      <ScrollReveal>
      <section className="bg-forest text-cornsilk">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 md:py-20 text-center flex flex-col items-center gap-5">
          <h2 className="font-merriweather text-3xl md:text-[44px] font-normal leading-tight">{about.cta.heading}</h2>
          <p className="font-montserrat text-[17px] text-cornsilk/80 leading-relaxed">{about.cta.subtext}</p>
          <div className="flex gap-4 flex-wrap justify-center mt-2">
            {about.cta.primaryButtonLabel && (
              <Link
                href={about.cta.primaryButtonLink || "/products"}
                className="bg-clay text-forest hover:bg-copper hover:text-cornsilk font-montserrat text-sm font-semibold uppercase tracking-[0.08em] px-8 py-4 rounded-[10px] transition-colors min-h-[44px] flex items-center justify-center"
              >
                {about.cta.primaryButtonLabel}
              </Link>
            )}
            {about.cta.secondaryButtonLabel && (
              <Link
                href={about.cta.secondaryButtonLink || "/blogs"}
                className="border border-[#6F7A55] hover:border-cornsilk/70 text-cornsilk font-montserrat text-sm font-semibold uppercase tracking-[0.08em] px-8 py-4 rounded-[10px] transition-colors min-h-[44px] flex items-center justify-center"
              >
                {about.cta.secondaryButtonLabel}
              </Link>
            )}
          </div>
        </div>
      </section>
      </ScrollReveal>
    </div>
  );
}

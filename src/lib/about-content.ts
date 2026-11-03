import type { AboutContent, AboutImage } from "@/types/admin";

export interface ResolvedAbout {
  hero: { eyebrow: string; headline: string; lead: string };
  story: { eyebrow: string; heading: string; body: string; image: AboutImage };
  values: AboutContent["drivesUs"];
  gallery: {
    isVisible: boolean;
    eyebrow: string;
    heading: string;
    linkLabel: string;
    linkHref: string;
    images: AboutImage[];
  };
  cta: AboutContent["cta"];
  extraSections: NonNullable<AboutContent["customSections"]>;
}

// Structural labels only. No invented story, values or slogans: those are the owner's to write in
// the admin, and a section with nothing written is not shown on the page.
export const ABOUT_DEFAULTS = {
  heroEyebrow: "",
  // every page needs a heading: the shop's name
  heroHeadline: "About Indian Mist",
  storyEyebrow: "Our Story",
  storyHeading: "",
  galleryEyebrow: "",
  galleryHeading: "",
  galleryLinkLabel: "Read our stories",
  galleryLinkHref: "/blogs",
  values: {
    heading: "",
    cards: [] as AboutContent["drivesUs"]["cards"],
  },
  cta: {
    heading: "",
    subtext: "",
    primaryButtonLabel: "Shop Now",
    secondaryButtonLabel: "Read Our Stories",
  },
};

const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

const img = (i?: Partial<AboutImage> | null): AboutImage => ({
  url: i?.url ?? "",
  publicId: i?.publicId ?? "",
  alt: i?.alt ?? "",
});

/**
 * Turns whatever is saved in the database into the exact content the page shows.
 * Every field falls back to a sensible default, and content saved before the hero/story
 * fields existed (everything in `mission`) is split up the way the page used to do it,
 * so the admin editor and the public page always agree.
 */
export function resolveAbout(saved: Partial<AboutContent> | null | undefined): ResolvedAbout {
  const s = saved ?? {};

  // Legacy: mission text written as one paragraph per line
  const paras = [...(s.mission?.body ?? "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => m[1].trim())
    .filter((t) => plain(t));
  const split = paras.length >= 3;
  const legacyStory = split ? paras.slice(1, -1) : paras;
  const legacyBlocks =
    legacyStory.length > 1
      ? [legacyStory.slice(0, -1).join(" "), legacyStory[legacyStory.length - 1]]
      : legacyStory;

  const sections = [...(s.customSections ?? [])].sort((a, b) => a.order - b.order);
  const useSectionImage = !s.story?.image?.url && !!sections[0]?.imageUrl;
  const lead = s.hero?.lead || (split ? plain(paras[paras.length - 1]) : "");

  const legacyBody =
    legacyBlocks.map((b) => `<p>${b}</p>`).join("") +
    (useSectionImage && sections[0].body
      ? `<p>${escapeHtml(sections[0].body).replace(/\n/g, "<br>")}</p>`
      : "");

  return {
    hero: {
      eyebrow: s.hero?.eyebrow || ABOUT_DEFAULTS.heroEyebrow,
      headline:
        s.hero?.headline ||
        (split ? plain(paras[0]) : s.mission?.heading || ABOUT_DEFAULTS.heroHeadline),
      lead,
    },
    story: {
      eyebrow: s.story?.eyebrow || (split ? s.mission?.heading : "") || ABOUT_DEFAULTS.storyEyebrow,
      heading:
        s.story?.heading ||
        (useSectionImage ? sections[0].heading : "") ||
        ABOUT_DEFAULTS.storyHeading,
      body: s.story?.body || legacyBody,
      image: useSectionImage
        ? { url: sections[0].imageUrl, publicId: sections[0].imagePublicId ?? "", alt: sections[0].imageAlt ?? "" }
        : img(s.story?.image),
    },
    values: s.drivesUs?.cards?.length ? { ...ABOUT_DEFAULTS.values, ...s.drivesUs } : ABOUT_DEFAULTS.values,
    gallery: {
      isVisible: s.gallery?.isVisible ?? true,
      eyebrow: s.gallery?.eyebrow || ABOUT_DEFAULTS.galleryEyebrow,
      heading: s.gallery?.heading || ABOUT_DEFAULTS.galleryHeading,
      linkLabel: s.gallery?.linkLabel ?? ABOUT_DEFAULTS.galleryLinkLabel,
      linkHref: s.gallery?.linkHref || ABOUT_DEFAULTS.galleryLinkHref,
      images: (s.gallery?.images ?? []).filter((i) => i?.url).map(img),
    },
    cta: { ...ABOUT_DEFAULTS.cta, ...(s.cta ?? {}) },
    extraSections: useSectionImage ? sections.slice(1) : sections,
  };
}

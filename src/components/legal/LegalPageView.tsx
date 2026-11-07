import { cache } from "react";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import LegalPage from "@/models/legal-page.model";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { sanitizeRichText } from "@/lib/sanitize";
import { LEGAL_DEFAULTS, hasLegalText, isOptionalLegalSlug, type LegalSlug } from "@/lib/legal-pages";

// Cached per render (the page title and the page body both ask for it). A database failure
// throws on purpose, so a failed regeneration keeps the last good policy text instead of
// caching the generic default (see src/lib/storefront-data.ts). A missing document is fine.
export const getLegalPage = cache(async (slug: LegalSlug) => {
  const fallback = LEGAL_DEFAULTS[slug];
  await dbConnect();
  const doc = await LegalPage.findOne({ slug }).lean<{ title?: string; content?: string }>();
  return {
    title: doc?.title?.trim() || fallback.title,
    content: doc?.content?.trim() ? doc.content : fallback.content,
  };
});

export async function LegalPageView({ slug }: { slug: LegalSlug }) {
  const { title, content } = await getLegalPage(slug);
  // An optional policy with no saved text is not a page
  if (isOptionalLegalSlug(slug) && !hasLegalText(content)) notFound();

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        <Breadcrumb className="pb-2" items={[{ label: "Home", href: "/" }, { label: title }]} />
        <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest mt-2 mb-8">
          {title}
        </h1>
        <article
          className="prose max-w-3xl font-montserrat text-forest/90 leading-[1.85]
            prose-headings:font-merriweather prose-headings:text-forest prose-headings:font-normal
            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
            prose-p:mb-4 prose-p:text-[15px]
            prose-a:text-olive prose-strong:text-forest prose-li:text-[15px]"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
        />
      </div>
    </div>
  );
}

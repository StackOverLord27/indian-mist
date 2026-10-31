import dbConnect from "@/lib/db";
import LegalPage from "@/models/legal-page.model";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { sanitizeRichText } from "@/lib/sanitize";
import { LEGAL_DEFAULTS, type LegalSlug } from "@/lib/legal-pages";

export async function getLegalPage(slug: LegalSlug) {
  const fallback = LEGAL_DEFAULTS[slug];
  try {
    await dbConnect();
    const doc = await LegalPage.findOne({ slug }).lean<{ title?: string; content?: string }>();
    return {
      title: doc?.title?.trim() || fallback.title,
      content: doc?.content?.trim() ? doc.content : fallback.content,
    };
  } catch (error) {
    console.error(`Failed to load ${slug}:`, error);
    return fallback;
  }
}

export async function LegalPageView({ slug }: { slug: LegalSlug }) {
  const { title, content } = await getLegalPage(slug);

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-20">
        <Breadcrumb className="pb-2" items={[{ label: "Home", href: "/" }, { label: title }]} />
        <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest mt-2 mb-8">
          {title}
        </h1>
        <article
          className="prose max-w-none font-montserrat text-forest/90 leading-[1.85]
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

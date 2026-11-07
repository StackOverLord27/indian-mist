import { Suspense } from "react";
import type { BlogPostData } from "@/types/blog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BlogsIndex, BlogsView } from "@/components/blog/BlogsIndex";
import { getPublishedBlogs, getPublishedBlogCategories } from "@/lib/blogs-list";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/storefront-data";
import { resolveBlogHeader } from "@/lib/blog-page-header";

export const metadata: Metadata = pageMetadata({ title: "Journal", path: "/blogs" });

// Cached page. Saving a post in the admin refreshes it straight away (revalidateStorefront).
// Only the newest 12 posts are in the cached page; "Load more" and the ?category= filter fetch
// further batches from /api/blogs in the browser (BlogsIndex), which keeps the page cacheable.
export const revalidate = 300;

async function getBlogs() {
  const [first, categories] = await Promise.all([getPublishedBlogs({ page: 1 }), getPublishedBlogCategories()]);
  return { blogs: first.blogs, hasMore: first.hasMore, categories };
}

export default async function BlogsPage() {
  const [{ blogs, categories, hasMore }, settings] = await Promise.all([getBlogs(), getSiteSettings()]);
  const header = resolveBlogHeader(settings?.blogPageSettings);

  return (
    <div className="bg-cornsilk min-h-screen page-enter">
      {/* Breadcrumb: same wrapper and spacing as /about, above the header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-4">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
      </div>

      {/* Hero header */}
      <div className="relative bg-forest overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(221,161,94,0.3) 0%, transparent 50%),
                              radial-gradient(circle at 80% 50%, rgba(96,108,56,0.3) 0%, transparent 50%)`,
          }} />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 py-16 md:py-20">
          {header.eyebrow && (
            <p className="font-montserrat text-xs uppercase tracking-[0.3em] text-clay mb-3">
              {header.eyebrow}
            </p>
          )}
          <h1 className="font-merriweather text-3xl md:text-5xl font-normal text-cornsilk leading-tight">
            {header.heading}
          </h1>
          {header.subtitle && (
            <p className="font-montserrat text-sm font-light text-cornsilk/80 mt-3 max-w-lg">
              {header.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-10 pb-20">
        <Suspense fallback={<BlogsView blogs={blogs} categories={categories} />}>
          <BlogsIndex blogs={blogs} categories={categories} hasMore={hasMore} />
        </Suspense>
      </div>
    </div>
  );
}

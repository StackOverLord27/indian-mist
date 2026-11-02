import { Suspense } from "react";
import type { BlogPostData } from "@/types/blog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import { BlogsIndex, BlogsView } from "@/components/blog/BlogsIndex";

// Cached page (the ?category= filter runs in the browser, see BlogsIndex). Saving a post in the
// admin refreshes it straight away (revalidateStorefront). No pagination yet: later prompt.
export const revalidate = 300;

async function getBlogs() {
  await dbConnect();

  const [blogs, categories] = await Promise.all([
    Blog.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .select("-content")
      .lean(),
    Blog.distinct("category", { isPublished: true }),
  ]);

  return { blogs: JSON.parse(JSON.stringify(blogs)) as BlogPostData[], categories: categories as string[] };
}

export default async function BlogsPage() {
  const { blogs, categories } = await getBlogs();

  return (
    <div className="bg-cornsilk min-h-screen page-enter">
      {/* Hero header */}
      <div className="relative bg-forest overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(221,161,94,0.3) 0%, transparent 50%),
                              radial-gradient(circle at 80% 50%, rgba(96,108,56,0.3) 0%, transparent 50%)`,
          }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          <p className="font-montserrat text-xs uppercase tracking-[0.3em] text-clay mb-3">
            Indian Mist Journal
          </p>
          <h1 className="font-merriweather text-3xl md:text-5xl font-normal text-cornsilk leading-tight">
            From the Trail
          </h1>
          <p className="font-montserrat text-sm font-light text-cornsilk/80 mt-3 max-w-lg">
            Stories, guides, and notes from the Indian Mist community — exploring the
            outdoors responsibly.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 pt-10 pb-20">
        {/* Breadcrumb */}
        <Breadcrumb
          className="mb-8"
          items={[
            { label: "Home", href: "/" },
            { label: "Blog" },
          ]}
        />

        <Suspense fallback={<BlogsView blogs={blogs} categories={categories} />}>
          <BlogsIndex blogs={blogs} categories={categories} />
        </Suspense>
      </div>
    </div>
  );
}

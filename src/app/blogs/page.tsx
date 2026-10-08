import Link from "next/link";
import type { BlogPostData } from "@/types/blog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import Image from "next/image";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export const revalidate = 0;

async function getBlogs(category?: string) {
  await dbConnect();
  const filter: Record<string, unknown> = { isPublished: true };
  if (category) filter.category = category;

  const [blogs, categories] = await Promise.all([
    Blog.find(filter)
      .sort({ publishedAt: -1 })
      .select("-content")
      .lean(),
    Blog.distinct("category", { isPublished: true }),
  ]);

  return { blogs: JSON.parse(JSON.stringify(blogs)) as BlogPostData[], categories };
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const { blogs, categories } = await getBlogs(category);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

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

        {/* Category filter tabs */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <Link
              href="/blogs"
              className={`font-montserrat text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-sm transition-all duration-200 ${
                !category
                  ? "bg-forest text-cornsilk shadow-sm"
                  : "bg-olive/8 text-forest/75 hover:bg-olive/15 hover:text-forest"
              }`}
            >
              All Posts
            </Link>
            {categories.map((cat: string) => (
              <Link
                key={cat}
                href={`/blogs?category=${encodeURIComponent(cat)}`}
                className={`font-montserrat text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-sm transition-all duration-200 ${
                  category === cat
                    ? "bg-forest text-cornsilk shadow-sm"
                    : "bg-olive/8 text-forest/75 hover:bg-olive/15 hover:text-forest"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>
        )}

        {/* Blog grid */}
        {blogs.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-olive/10 flex items-center justify-center">
              <Clock className="size-7 text-olive/70" />
            </div>
            <p className="font-merriweather text-xl text-forest mb-2">
              {category ? `No posts in "${category}" yet` : "Coming soon"}
            </p>
            <p className="font-montserrat text-sm text-muted-text max-w-md mx-auto">
              {category
                ? "Try a different category or check back later."
                : "We're working on some great content. Check back shortly."}
            </p>
            <Link
              href="/"
              className="inline-block mt-6 font-montserrat text-xs uppercase tracking-widest text-olive-leaf border-b border-olive-leaf/40 hover:border-olive-leaf transition-colors"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            {/* Featured post (first post, bounded compact size) */}
            {blogs.length > 0 && (
              <ScrollReveal className="mb-12">
              <Link
                href={`/blogs/${blogs[0].slug}`}
                className="group block"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 bg-card-bg rounded-md overflow-hidden border border-olive/12 hover:border-olive/30 transition-all duration-300 hover:shadow-md">
                  {/* Left Column: Framed Image with fixed bounded height */}
                  <div className="md:col-span-5 bg-card/60 p-4 sm:p-5 flex items-center justify-center border-b md:border-b-0 md:border-r border-olive/10">
                    <div className="relative w-full h-50 sm:h-55 md:h-60 bg-warm/30 border border-olive/15 rounded-xs p-3 flex items-center justify-center overflow-hidden shadow-xs">
                      {blogs[0].coverImage?.url ? (
                        <Image
                          src={blogs[0].coverImage.url}
                          alt={blogs[0].coverImage.alt || blogs[0].title}
                          fill
                          className="object-contain p-3 group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-olive/10 flex items-center justify-center">
                          <span className="font-merriweather text-4xl text-olive/20">
                            IM
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Content */}
                  <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-montserrat text-[10px] uppercase tracking-widest text-copper font-semibold bg-clay/15 px-2.5 py-1 rounded-sm">
                        {blogs[0].category}
                      </span>
                      <span className="font-montserrat text-[10px] text-muted-text font-medium">
                        Featured
                      </span>
                    </div>
                    <h2 className="font-merriweather text-2xl md:text-3xl text-forest leading-snug group-hover:text-olive transition-colors">
                      {blogs[0].title}
                    </h2>
                    {blogs[0].excerpt && (
                      <p className="font-montserrat text-sm text-muted-text mt-3 leading-relaxed line-clamp-3">
                        {blogs[0].excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-olive/70" />
                        <span className="font-montserrat text-xs text-muted-text">
                          {formatDate(blogs[0].publishedAt || blogs[0].createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-olive/70" />
                        <span className="font-montserrat text-xs text-muted-text">
                          {blogs[0].readTime} min read
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 font-montserrat text-xs uppercase tracking-wider text-olive font-semibold group-hover:gap-3 transition-all">
                      Read Article
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                </div>
              </Link>
              </ScrollReveal>
            )}

            {/* Remaining posts grid */}
            {blogs.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {blogs.slice(1).map((blog) => (
                  <ScrollReveal key={blog._id} className="h-full">
                  <Link
                    href={`/blogs/${blog.slug}`}
                    className="group block h-full"
                  >
                    <article className="bg-card-bg rounded-md overflow-hidden border border-olive/8 hover:border-olive/20 transition-all duration-300 hover:shadow-sm h-full flex flex-col">
                      {/* Cover */}
                      <div className="relative h-44 w-full bg-warm/30 p-2.5 flex items-center justify-center overflow-hidden border-b border-olive/8">
                        {blog.coverImage?.url ? (
                          <Image
                            src={blog.coverImage.url}
                            alt={blog.coverImage.alt || blog.title}
                            fill
                            className="object-contain p-2.5 group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-olive/10 flex items-center justify-center">
                            <span className="font-merriweather text-3xl text-olive/15">
                              IM
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-montserrat text-[10px] uppercase tracking-widest text-copper font-semibold bg-clay/15 px-2 py-0.5 rounded-sm">
                            {blog.category}
                          </span>
                          <span className="font-montserrat text-[10px] text-muted-text">
                            {blog.readTime} min
                          </span>
                        </div>
                        <h3 className="font-merriweather text-base text-forest leading-snug group-hover:text-olive transition-colors line-clamp-2">
                          {blog.title}
                        </h3>
                        <p className="font-montserrat text-xs text-muted-text mt-2 leading-relaxed line-clamp-2 flex-1">
                          {blog.excerpt}
                        </p>
                        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-olive/8">
                          <Calendar className="size-3 text-olive/70" />
                          <span className="font-montserrat text-[10px] text-muted-text">
                            {formatDate(blog.publishedAt || blog.createdAt)}
                          </span>
                          <span className="ml-auto font-montserrat text-[10px] text-muted-text">
                            By {blog.author}
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

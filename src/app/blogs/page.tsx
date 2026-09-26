import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import { Calendar, Clock, ArrowRight } from "lucide-react";

async function getBlogs(category?: string) {
  await dbConnect();
  const filter: Record<string, any> = { isPublished: true };
  if (category) filter.category = category;

  const [blogs, categories] = await Promise.all([
    Blog.find(filter)
      .sort({ publishedAt: -1 })
      .select("-content")
      .lean(),
    Blog.distinct("category", { isPublished: true }),
  ]);

  return { blogs: JSON.parse(JSON.stringify(blogs)), categories };
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
    <div className="bg-cornsilk min-h-screen">
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
          <p className="font-montserrat text-sm font-light text-cornsilk/70 mt-3 max-w-lg">
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
                  : "bg-olive/8 text-forest/60 hover:bg-olive/15 hover:text-forest"
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
                    : "bg-olive/8 text-forest/60 hover:bg-olive/15 hover:text-forest"
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
              <Clock className="size-7 text-olive/40" />
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
            {/* Featured post (first post, larger) */}
            {blogs.length > 0 && (
              <Link
                href={`/blogs/${blogs[0].slug}`}
                className="group block mb-12"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 bg-card-bg rounded-md overflow-hidden border border-olive/8 hover:border-olive/20 transition-all duration-300">
                  {/* Image */}
                  <div className="aspect-[16/10] md:aspect-auto md:h-full overflow-hidden">
                    {blogs[0].coverImage?.url ? (
                      <img
                        src={blogs[0].coverImage.url}
                        alt={blogs[0].coverImage.alt || blogs[0].title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[280px] bg-olive/10 flex items-center justify-center">
                        <span className="font-merriweather text-5xl text-olive/15">
                          IM
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="font-montserrat text-[10px] uppercase tracking-widest text-copper font-semibold bg-clay/15 px-2.5 py-1 rounded-sm">
                        {blogs[0].category}
                      </span>
                      <span className="font-montserrat text-[10px] text-muted-text">
                        Featured
                      </span>
                    </div>
                    <h2 className="font-merriweather text-2xl md:text-3xl text-forest leading-snug group-hover:text-olive transition-colors">
                      {blogs[0].title}
                    </h2>
                    <p className="font-montserrat text-sm text-muted-text mt-3 leading-relaxed line-clamp-3">
                      {blogs[0].excerpt}
                    </p>
                    <div className="flex items-center gap-4 mt-6">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-olive/50" />
                        <span className="font-montserrat text-xs text-muted-text">
                          {formatDate(blogs[0].publishedAt || blogs[0].createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-olive/50" />
                        <span className="font-montserrat text-xs text-muted-text">
                          {blogs[0].readTime} min read
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 font-montserrat text-xs uppercase tracking-wider text-olive font-semibold group-hover:gap-3 transition-all">
                      Read Article
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Remaining posts grid */}
            {blogs.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {blogs.slice(1).map((blog: any) => (
                  <Link
                    key={blog._id}
                    href={`/blogs/${blog.slug}`}
                    className="group block"
                  >
                    <article className="bg-card-bg rounded-md overflow-hidden border border-olive/8 hover:border-olive/20 transition-all duration-300 hover:shadow-sm h-full flex flex-col">
                      {/* Cover */}
                      <div className="aspect-[16/10] overflow-hidden">
                        {blog.coverImage?.url ? (
                          <img
                            src={blog.coverImage.url}
                            alt={blog.coverImage.alt || blog.title}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
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
                          <Calendar className="size-3 text-olive/40" />
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

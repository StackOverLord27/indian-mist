import { sanitizeRichText } from "@/lib/sanitize";
import type { BlogPostData } from "@/types/blog";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import { Calendar, Clock, ArrowLeft, ArrowRight, User } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 0;

async function getBlogBySlug(slug: string) {
  await dbConnect();
  const blog = await Blog.findOne({ slug, isPublished: true }).lean();
  if (!blog) return null;

  const related = await Blog.find({
    isPublished: true,
    category: blog.category,
    _id: { $ne: blog._id },
  })
    .sort({ publishedAt: -1 })
    .limit(3)
    .select("-content")
    .lean();

  return {
    blog: JSON.parse(JSON.stringify(blog)) as BlogPostData,
    related: JSON.parse(JSON.stringify(related)) as BlogPostData[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  await dbConnect();
  const blog = await Blog.findOne({ slug, isPublished: true })
    .select("title excerpt")
    .lean<{ title: string; excerpt: string }>();

  if (!blog) return { title: "Blog Post Not Found | Indian Mist" };

  return {
    title: `${blog.title} | Indian Mist Blog`,
    description: blog.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getBlogBySlug(slug);

  if (!data) notFound();

  const { blog, related } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="bg-cornsilk min-h-screen page-enter">
      {/* Breadcrumb section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 pt-6 pb-2">
        <Breadcrumb
          className="pt-2 pb-2"
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blogs" },
            {
              label: blog.category,
              href: `/blogs?category=${encodeURIComponent(blog.category)}`,
            },
            { label: blog.title },
          ]}
        />
      </div>

      {/* Main split layout container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 pt-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-start">
          
          {/* Left Column: Framed cover image box (compact, bounded height) */}
          <div className="lg:col-span-4 xl:col-span-4 lg:sticky lg:top-24">
            {blog.coverImage?.url ? (
              <div className="bg-card/90 backdrop-blur-xs border-2 border-olive/20 rounded-md p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow">
                {/* Gallery frame matting & border */}
                <div className="relative bg-warm/30 border border-olive/15 rounded-xs h-55 sm:h-60 md:h-65 overflow-hidden">
                  <Image
                    src={blog.coverImage.url}
                    alt={blog.coverImage.alt || blog.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-contain p-2.5 sm:p-3 rounded-xs transition-transform duration-300 hover:scale-[1.01]"
                  />
                </div>

                {/* Frame footer / caption */}
                <div className="mt-2.5 px-1 flex items-center justify-between text-[11px] font-montserrat text-muted-text/80">
                  <span className="truncate max-w-45 sm:max-w-50">
                    {blog.coverImage.alt || blog.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-olive/80 font-semibold ml-2 shrink-0">
                    {blog.category}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-card/90 border-2 border-olive/20 rounded-md p-6 h-60 flex items-center justify-center text-olive/30 font-merriweather text-xl">
                Indian Mist
              </div>
            )}
          </div>

          {/* Right Column: Write-up & everything */}
          <div className={blog.coverImage?.url ? "lg:col-span-8 xl:col-span-8 min-w-0" : "lg:col-span-8 lg:col-start-3 min-w-0"}>
            <header className="mb-8">
              <span className="inline-block font-montserrat text-[10px] uppercase tracking-widest text-copper font-semibold bg-clay/15 px-3 py-1 rounded-sm mb-4">
                {blog.category}
              </span>

              <h1 className="font-merriweather text-3xl sm:text-4xl lg:text-[2.65rem] font-normal text-forest leading-tight tracking-tight">
                {blog.title}
              </h1>

              {blog.excerpt && (
                <p className="font-montserrat text-base sm:text-lg text-muted-text/90 mt-4 leading-relaxed font-light border-l-2 border-olive/30 pl-4 py-0.5">
                  {blog.excerpt}
                </p>
              )}

              {/* Author & Meta bar */}
              <div className="flex items-center flex-wrap gap-4 sm:gap-6 mt-6 pt-5 pb-5 border-y border-olive/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-olive/15 flex items-center justify-center text-olive">
                    <User className="size-4" />
                  </div>
                  <div>
                    <p className="font-montserrat text-xs text-forest font-semibold leading-tight">
                      {blog.author || "Indian Mist Staff"}
                    </p>
                    <p className="font-montserrat text-[10px] text-muted-text mt-0.5">
                      Author
                    </p>
                  </div>
                </div>

                <div className="h-6 w-px bg-olive/10 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-muted-text">
                  <Calendar className="size-3.5 text-olive/80" />
                  <span className="font-montserrat text-xs">
                    {formatDate(blog.publishedAt || blog.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-muted-text">
                  <Clock className="size-3.5 text-olive/80" />
                  <span className="font-montserrat text-xs">
                    {blog.readTime} min read
                  </span>
                </div>
              </div>

              {/* Tags */}
              {blog.tags && blog.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {blog.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-montserrat text-[10px] text-muted-text bg-olive/5 border border-olive/15 rounded-sm px-2.5 py-0.5 font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Article content */}
            <article
              className="prose prose-lg max-w-none
                font-montserrat text-forest/90 leading-[1.85]
                prose-headings:font-merriweather prose-headings:text-forest prose-headings:font-normal
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-olive/10 prose-h2:pb-2
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:mb-5 prose-p:text-[15px] prose-p:leading-[1.85]
                prose-a:text-olive prose-a:underline-offset-2 prose-a:decoration-olive/30 hover:prose-a:decoration-olive
                prose-strong:text-forest prose-strong:font-semibold
                prose-ul:my-4 prose-li:my-1 prose-li:text-[15px]
                prose-ol:my-4
                prose-blockquote:border-l-2 prose-blockquote:border-olive prose-blockquote:bg-olive/5 prose-blockquote:p-4 prose-blockquote:rounded-r-sm prose-blockquote:text-forest/80 prose-blockquote:font-merriweather prose-blockquote:not-italic
                prose-img:rounded-md prose-img:shadow-sm prose-img:border prose-img:border-olive/10
                pb-12"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(blog.content) }}
            />

            {/* Back link */}
            <div className="border-t border-olive/10 pt-6 pb-6">
              <Link
                href="/blogs"
                className="inline-flex items-center gap-2 font-montserrat text-xs uppercase tracking-widest text-olive hover:text-forest transition-colors font-semibold"
              >
                <ArrowLeft className="size-4" />
                Back to all posts
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="bg-warm-mist border-t border-olive/8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-16">
            <h2 className="font-merriweather text-xl text-forest mb-8">
              More from {blog.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((post) => (
                <Link
                  key={post._id}
                  href={`/blogs/${post.slug}`}
                  className="group block"
                >
                  <article className="bg-card-bg rounded-md overflow-hidden border border-olive/8 hover:border-olive/20 transition-all duration-300 hover:shadow-sm">
                    <div className="relative aspect-16/10 overflow-hidden">
                      {post.coverImage?.url ? (
                        <Image
                          src={post.coverImage.url}
                          alt={post.coverImage.alt || post.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-olive/10 flex items-center justify-center">
                          <span className="font-merriweather text-3xl text-olive/15">
                            IM
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-merriweather text-sm text-forest leading-snug group-hover:text-olive transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="font-montserrat text-[10px] text-muted-text">
                          {formatDate(post.publishedAt || post.createdAt)}
                        </span>
                        <span className="font-montserrat text-[10px] text-muted-text">
                          {post.readTime} min read
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

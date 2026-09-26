import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import { Calendar, Clock, ArrowLeft, ArrowRight, User } from "lucide-react";
import type { Metadata } from "next";

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
    blog: JSON.parse(JSON.stringify(blog)),
    related: JSON.parse(JSON.stringify(related)),
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
    .lean();

  if (!blog) return { title: "Blog Post Not Found | Indian Mist" };

  return {
    title: `${(blog as any).title} | Indian Mist Blog`,
    description: (blog as any).excerpt,
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
    <div className="bg-cornsilk min-h-screen">
      {/* Cover image hero */}
      {blog.coverImage?.url && (
        <div className="relative w-full h-[340px] md:h-[440px] overflow-hidden bg-forest">
          <img
            src={blog.coverImage.url}
            alt={blog.coverImage.alt || blog.title}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/30 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 md:px-12 lg:px-16">
        {/* Breadcrumb */}
        <Breadcrumb
          className="pt-8 pb-4"
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

        {/* Article header */}
        <header className="mb-10">
          <span className="inline-block font-montserrat text-[10px] uppercase tracking-widest text-copper font-semibold bg-clay/15 px-2.5 py-1 rounded-sm mb-4">
            {blog.category}
          </span>

          <h1 className="font-merriweather text-3xl md:text-4xl lg:text-[2.75rem] font-normal text-forest leading-tight">
            {blog.title}
          </h1>

          <p className="font-montserrat text-base text-muted-text mt-4 leading-relaxed">
            {blog.excerpt}
          </p>

          {/* Meta */}
          <div className="flex items-center flex-wrap gap-4 mt-6 pt-6 border-t border-olive/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-olive/15 flex items-center justify-center">
                <User className="size-4 text-olive" />
              </div>
              <span className="font-montserrat text-xs text-forest font-medium">
                {blog.author}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-olive/50" />
              <span className="font-montserrat text-xs text-muted-text">
                {formatDate(blog.publishedAt || blog.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-olive/50" />
              <span className="font-montserrat text-xs text-muted-text">
                {blog.readTime} min read
              </span>
            </div>
          </div>

          {/* Tags */}
          {blog.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {blog.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="font-montserrat text-[10px] text-muted-text border border-olive/15 rounded-sm px-2 py-0.5"
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
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:mb-5 prose-p:text-[15px]
            prose-a:text-olive prose-a:underline-offset-2 prose-a:decoration-olive/30 hover:prose-a:decoration-olive
            prose-strong:text-forest prose-strong:font-semibold
            prose-ul:my-4 prose-li:my-1 prose-li:text-[15px]
            prose-ol:my-4
            prose-blockquote:border-olive/30 prose-blockquote:text-forest/70 prose-blockquote:not-italic prose-blockquote:font-merriweather
            prose-img:rounded-md prose-img:shadow-sm
            pb-16 mb-0"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />

        {/* Back link */}
        <div className="border-t border-olive/10 pt-8 pb-10">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-2 font-montserrat text-xs uppercase tracking-widest text-olive hover:text-forest transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to all posts
          </Link>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="bg-warm-mist border-t border-olive/8">
          <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-16">
            <h2 className="font-merriweather text-xl text-forest mb-8">
              More from {blog.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((post: any) => (
                <Link
                  key={post._id}
                  href={`/blogs/${post.slug}`}
                  className="group block"
                >
                  <article className="bg-card-bg rounded-md overflow-hidden border border-olive/8 hover:border-olive/20 transition-all duration-300 hover:shadow-sm">
                    <div className="aspect-[16/10] overflow-hidden">
                      {post.coverImage?.url ? (
                        <img
                          src={post.coverImage.url}
                          alt={post.coverImage.alt || post.title}
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

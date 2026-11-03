import dbConnect from "@/lib/db";
import { Blog } from "@/models/blog.model";
import type { BlogPostData } from "@/types/blog";

/** Posts per batch on the blog index. */
export const BLOGS_PAGE_SIZE = 12;
export const BLOGS_MAX_PAGE_SIZE = 50;

/**
 * One batch of published posts (newest first), without their full text. Used by the /blogs page
 * (first batch) and /api/blogs ("Load more" and the category filter).
 */
export async function getPublishedBlogs(opts: { page?: number; limit?: number; category?: string }): Promise<{
  blogs: BlogPostData[];
  total: number;
  hasMore: boolean;
}> {
  await dbConnect();
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? BLOGS_PAGE_SIZE) || BLOGS_PAGE_SIZE), BLOGS_MAX_PAGE_SIZE);
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), 1000);
  const filter: Record<string, unknown> = { isPublished: true };
  if (opts.category) filter.category = opts.category;

  const [blogs, total] = await Promise.all([
    // _id is the final tie-breaker so two posts with the same date never swap between batches
    Blog.find(filter).sort({ publishedAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).select("-content").lean(),
    Blog.countDocuments(filter),
  ]);
  return {
    blogs: JSON.parse(JSON.stringify(blogs)) as BlogPostData[],
    total,
    hasMore: (page - 1) * limit + limit < total,
  };
}

/** The categories that have at least one published post (for the filter tabs). */
export async function getPublishedBlogCategories(): Promise<string[]> {
  await dbConnect();
  return ((await Blog.distinct("category", { isPublished: true })) as string[]).sort((a, b) => a.localeCompare(b));
}

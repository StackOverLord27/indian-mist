export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withDB, successResponse, errorResponse } from "@/lib/api-helpers";
import { Blog } from "@/models/blog.model";

export const GET = withDB(async (req: NextRequest, context) => {
  const params = await context.params;
  const blog = await Blog.findOne({
    slug: params.slug,
    isPublished: true,
  }).lean();

  if (!blog) return errorResponse("Blog post not found", 404);

  // Fetch related posts (same category, excluding current)
  const related = await Blog.find({
    isPublished: true,
    category: blog.category,
    _id: { $ne: blog._id },
  })
    .sort({ publishedAt: -1 })
    .limit(3)
    .select("-content")
    .lean();

  return successResponse({ blog, related });
});

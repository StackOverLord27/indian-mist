export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { withDB, successResponse } from "@/lib/api-helpers";
import { Blog } from "@/models/blog.model";

export const GET = withDB(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(20, Number(searchParams.get("limit") ?? 12));
  const category = searchParams.get("category");

  const filter: Record<string, unknown> = { isPublished: true };
  if (category) filter.category = category;

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-content") // exclude heavy content for listing
      .lean(),
    Blog.countDocuments(filter),
  ]);

  // Also fetch unique categories for filter tabs
  const categories = await Blog.distinct("category", { isPublished: true });

  return successResponse({
    blogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    categories,
  });
});

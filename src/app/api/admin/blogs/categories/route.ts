export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { withAdmin, successResponse, errorResponse } from "@/lib/api-helpers";
import { BlogCategory } from "@/models/blog-category.model";
import { Blog } from "@/models/blog.model";

const DEFAULT_CATEGORIES = [
  "Trail Stories",
  "Gear Guides",
  "Sustainability",
  "Brand Updates",
  "Tips & Tricks",
];

async function getAllMergedCategories(): Promise<string[]> {
  const [saved, distinctFromBlogs] = await Promise.all([
    BlogCategory.find().sort({ name: 1 }).lean(),
    Blog.distinct("category"),
  ]);

  const seen = new Set<string>();
  const categories: string[] = [];

  const add = (name: string) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      categories.push(trimmed);
    }
  };

  // Add saved custom categories
  saved.forEach((s: any) => add(s.name));
  // Add any existing categories currently on blogs
  distinctFromBlogs.forEach((c: any) => add(c));
  // Add defaults
  DEFAULT_CATEGORIES.forEach((c) => add(c));

  return categories;
}

export const GET = withAdmin(async () => {
  const categories = await getAllMergedCategories();
  return successResponse({ categories });
});

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const name = body?.name;

    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse("Category name is required", 400);
    }

    const trimmedName = name.trim();

    // Check if category already exists (case-insensitive)
    let categoryDoc = await BlogCategory.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (!categoryDoc) {
      categoryDoc = await BlogCategory.create({
        name: trimmedName,
      });
    }

    const categories = await getAllMergedCategories();

    return successResponse(
      {
        category: categoryDoc.name,
        categories,
      },
      201
    );
  } catch (error: any) {
    console.error("Failed to create blog category:", error);
    return errorResponse(error?.message || "Failed to create category", 500);
  }
});

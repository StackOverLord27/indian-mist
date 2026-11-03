export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin, successResponse, parseJsonBody, validationError } from "@/lib/api-helpers";
import { BlogCategory } from "@/models/blog-category.model";
import { Blog } from "@/models/blog.model";
import { escapeRegex } from "@/lib/pagination";

const DEFAULT_CATEGORIES = [
  "Trail Stories",
  "Gear Guides",
  "Sustainability",
  "Brand Updates",
  "Tips & Tricks",
];

async function getAllMergedCategories(): Promise<string[]> {
  const [saved, distinctFromBlogs] = await Promise.all([
    BlogCategory.find().sort({ name: 1 }).lean<{ name: string }[]>(),
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
  saved.forEach((s) => add(s.name));
  // Add any existing categories currently on blogs
  distinctFromBlogs.forEach((c) => add(String(c)));
  // Add defaults
  DEFAULT_CATEGORIES.forEach((c) => add(c));

  return categories;
}

export const GET = withAdmin(async () => {
  const categories = await getAllMergedCategories();
  return successResponse({ categories });
});

const CategoryNameSchema = z.object({ name: z.string().trim().min(1, "Category name is required").max(60, "Category name is at most 60 characters") });

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = CategoryNameSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);
  const trimmedName = parsed.data.name;

  // Check if category already exists (case-insensitive)
  let categoryDoc = await BlogCategory.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
  });

  if (!categoryDoc) {
    categoryDoc = await BlogCategory.create({ name: trimmedName });
  }

  const categories = await getAllMergedCategories();

  return successResponse({ category: categoryDoc.name, categories }, 201);
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  withAdmin,
  parseFormData,
  validateImageFile,
  errorResponse,
  successResponse,
} from "@/lib/api-helpers";
import { Blog } from "@/models/blog.model";
import { uploadImage } from "@/lib/cloudinary";
import { BlogSchema } from "@/schemas/blog";

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
  const category = searchParams.get("category");
  const status = searchParams.get("status"); // "published" | "draft"

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (status === "published") filter.isPublished = true;
  if (status === "draft") filter.isPublished = false;

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-content") // exclude heavy content for listing
      .lean(),
    Blog.countDocuments(filter),
  ]);

  return successResponse({
    blogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export const POST = withAdmin(async (req) => {
  const { fields, files } = await parseFormData(req);

  const parseJSON = <T>(val: string | undefined, fallback: T): T => {
    try {
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  const parsedFields = {
    title: fields.title?.trim(),
    excerpt: fields.excerpt?.trim(),
    content: fields.content?.trim(),
    category: fields.category?.trim(),
    tags: parseJSON(fields.tags, []),
    author: fields.author?.trim() || "Indian Mist",
    isPublished: fields.isPublished === "true",
  };

  const validationResult = BlogSchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join(".")] = err.message;
    });
    return errorResponse("Validation failed", 400, errors);
  }

  // Upload cover image if provided
  let coverImage = { url: "", publicId: "", alt: "" };
  if (files.length > 0) {
    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }
    const result = await uploadImage(file.buffer, {
      folder: "indian-mist/blogs",
    });
    coverImage = {
      url: result.url,
      publicId: result.publicId,
      alt: fields.coverImageAlt ?? parsedFields.title ?? "",
    };
  }

  const blog = await Blog.create({
    ...parsedFields,
    coverImage,
  });

  return successResponse({ blog }, 201);
});

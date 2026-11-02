export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  withAdmin,
  parseFormData,
  validateImageFile,
  errorResponse,
  successResponse,
  validationError,
  jsonFormField,
} from "@/lib/api-helpers";
import { Blog } from "@/models/blog.model";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { BlogSchema } from "@/schemas/blog";
import { revalidateStorefront } from "@/lib/revalidate-storefront";

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

/** Validate, then upload the cover, then save; a failed save deletes the cover uploaded in this request. */
export const POST = withAdmin(async (req: NextRequest) => {
  const { fields, files } = await parseFormData(req);

  const validated = BlogSchema.safeParse({
    title: fields.title,
    excerpt: fields.excerpt,
    content: fields.content,
    category: fields.category,
    tags: jsonFormField<string[]>(fields, "tags") ?? [],
    author: fields.author?.trim() || "Indian Mist",
    isPublished: fields.isPublished === "true",
  });
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const file = files[0];
  if (file) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { file: validation.message! });
  }

  let coverImage = { url: "", publicId: "", alt: "" };
  try {
    if (file) {
      const result = await uploadImage(file.buffer, { folder: "indian-mist/blogs" });
      coverImage = { url: result.url, publicId: result.publicId, alt: fields.coverImageAlt ?? parsed.title };
    }

    const blog = await Blog.create({ ...parsed, coverImage });

    revalidateStorefront();
    return successResponse({ blog }, 201);
  } catch (error) {
    if (coverImage.publicId) await deleteImage(coverImage.publicId);
    throw error;
  }
});

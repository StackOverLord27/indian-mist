export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  withAdmin,
  parseFormData,
  validateImageFile,
  errorResponse,
  successResponse,
} from "@/lib/api-helpers";
import { Blog } from "@/models/blog.model";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { BlogSchema } from "@/schemas/blog";

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  const blog = await Blog.findById(params.id).lean();
  if (!blog) return errorResponse("Blog not found", 404);
  return successResponse({ blog });
});

export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  const blog = await Blog.findById(params.id);
  if (!blog) return errorResponse("Blog not found", 404);

  const { fields, files } = await parseFormData(req);

  const parseJSON = <T>(val: string | undefined, fb: T): T => {
    try {
      return val ? JSON.parse(val) : fb;
    } catch {
      return fb;
    }
  };

  // Upload new cover image if provided
  if (files.length > 0) {
    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }

    // Delete old image if exists
    if (blog.coverImage?.publicId) {
      await deleteImage(blog.coverImage.publicId);
    }

    const result = await uploadImage(file.buffer, {
      folder: "indian-mist/blogs",
    });
    blog.coverImage = {
      url: result.url,
      publicId: result.publicId,
      alt: fields.coverImageAlt ?? blog.coverImage?.alt ?? "",
    };
  } else if (fields.coverImageAlt !== undefined) {
    blog.coverImage = {
      ...blog.coverImage,
      alt: fields.coverImageAlt,
    };
  }

  // Update fields
  const parsedFields = {
    title: fields.title?.trim() ?? blog.title,
    excerpt: fields.excerpt?.trim() ?? blog.excerpt,
    content: fields.content?.trim() ?? blog.content,
    category: fields.category?.trim() ?? blog.category,
    tags: fields.tags ? parseJSON(fields.tags, []) : blog.tags,
    author: fields.author?.trim() || blog.author,
    isPublished:
      fields.isPublished !== undefined
        ? fields.isPublished === "true"
        : blog.isPublished,
  };

  const validationResult = BlogSchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join(".")] = err.message;
    });
    return errorResponse("Validation failed", 400, errors);
  }

  // Set publishedAt if newly publishing
  if (parsedFields.isPublished && !blog.isPublished) {
    blog.publishedAt = new Date();
  }

  Object.assign(blog, parsedFields);
  await blog.save();

  return successResponse({ blog });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  const blog = await Blog.findById(params.id);
  if (!blog) return errorResponse("Blog not found", 404);

  // Delete cover image from Cloudinary
  if (blog.coverImage?.publicId) {
    await deleteImage(blog.coverImage.publicId);
  }

  await blog.deleteOne();
  return successResponse({ message: "Blog deleted successfully" });
});

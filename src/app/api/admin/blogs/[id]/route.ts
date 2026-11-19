export const runtime = "nodejs";
// Uploads to Cloudinary can take a while (up to 10 images in one request); allow a full minute
export const maxDuration = 60;

import mongoose from "mongoose";
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

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse("Blog not found", 404);
  const blog = await Blog.findById(params.id).lean();
  if (!blog) return errorResponse("Blog not found", 404);
  return successResponse({ blog });
});

/**
 * Validate, upload the new cover (if any), save, and only then delete the old cover from
 * Cloudinary (replaced, or removed with removeCoverImage=true). A failed save deletes the
 * new upload and keeps the old cover.
 */
export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse("Blog not found", 404);
  const blog = await Blog.findById(params.id);
  if (!blog) return errorResponse("Blog not found", 404);

  const { fields, files } = await parseFormData(req);

  const validated = BlogSchema.safeParse({
    title: fields.title?.trim() ?? blog.title,
    excerpt: fields.excerpt?.trim() ?? blog.excerpt,
    content: fields.content?.trim() ?? blog.content,
    category: fields.category?.trim() ?? blog.category,
    tags: jsonFormField<string[]>(fields, "tags") ?? blog.tags,
    author: fields.author?.trim() || blog.author,
    isPublished: fields.isPublished !== undefined ? fields.isPublished === "true" : blog.isPublished,
  });
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const file = files[0];
  if (file) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { file: validation.message! });
  }

  const oldPublicId = blog.coverImage?.publicId || "";
  const removeCover = fields.removeCoverImage === "true" && !file;

  let uploadedPublicId = "";
  try {
    if (file) {
      const result = await uploadImage(file.buffer, { folder: "indian-mist/blogs" });
      uploadedPublicId = result.publicId;
      blog.coverImage = {
        url: result.url,
        publicId: result.publicId,
        alt: fields.coverImageAlt ?? blog.coverImage?.alt ?? "",
      };
    } else if (removeCover) {
      blog.coverImage = { url: "", publicId: "", alt: "" };
    } else if (fields.coverImageAlt !== undefined) {
      blog.coverImage = { ...blog.coverImage, alt: fields.coverImageAlt };
    }

    // Set publishedAt if newly publishing
    if (parsed.isPublished && !blog.isPublished) {
      blog.publishedAt = new Date();
    }

    blog.set(parsed);
    await blog.save();
  } catch (error) {
    if (uploadedPublicId) await deleteImage(uploadedPublicId);
    throw error;
  }

  // Saved: the old cover is no longer referenced
  if (oldPublicId && (uploadedPublicId || removeCover)) await deleteImage(oldPublicId);

  revalidateStorefront();
  return successResponse({ blog });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse("Blog not found", 404);
  const blog = await Blog.findById(params.id);
  if (!blog) return errorResponse("Blog not found", 404);

  const publicId = blog.coverImage?.publicId;

  // Document first; the cover is only deleted once nothing points at it
  await blog.deleteOne();
  if (publicId) await deleteImage(publicId);

  revalidateStorefront();
  return successResponse({ message: "Blog deleted successfully" });
});

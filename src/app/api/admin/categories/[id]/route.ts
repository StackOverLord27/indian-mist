export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse, validationError } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CategorySchema } from '@/schemas/admin';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Category not found', 404);
  const category = await Category.findById(params.id).lean();
  if (!category) return errorResponse('Category not found', 404);
  return successResponse({ category });
});

/**
 * Validate, upload the new image (if any), save, and only then delete the old image from
 * Cloudinary (when it was replaced or removed). A failed save deletes the new upload and
 * keeps the old image.
 */
export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Category not found', 404);
  const category = await Category.findById(params.id);
  if (!category) return errorResponse('Category not found', 404);

  const { fields, files } = await parseFormData(req);

  const validated = CategorySchema.safeParse({
    name: fields.name?.trim() ?? category.name,
    description: fields.description?.trim() ?? category.description,
    isFeatured: fields.isFeatured !== undefined ? fields.isFeatured === 'true' : category.isFeatured,
    isHidden: fields.isHidden !== undefined ? fields.isHidden === 'true' : category.isHidden,
  });
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const file = files[0];
  if (file) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { images: validation.message! });
  }

  const oldPublicId = category.image?.publicId || '';
  // Only the category's own image can be removed; any other id the browser sends is ignored
  const removeCurrent = !!oldPublicId && fields.removedImageId === oldPublicId;

  let uploadedPublicId = '';
  try {
    if (file) {
      const result = await uploadImage(file.buffer, { folder: 'indian-mist/categories' });
      uploadedPublicId = result.publicId;
      category.image = { url: result.url, publicId: result.publicId, alt: fields.imageAlt ?? '' };
    } else if (removeCurrent) {
      category.image = undefined;
    } else if (fields.imageAlt !== undefined && category.image) {
      category.image.alt = fields.imageAlt;
    }

    // The slug is not changed when the name changes, so existing links keep working
    category.name = parsed.name;
    category.description = parsed.description ?? '';
    category.isFeatured = parsed.isFeatured;
    category.isHidden = parsed.isHidden;

    await category.save();
  } catch (error) {
    if (uploadedPublicId) await deleteImage(uploadedPublicId);
    throw error;
  }

  // Saved: the old image is no longer referenced
  if (oldPublicId && (uploadedPublicId || removeCurrent)) await deleteImage(oldPublicId);

  revalidateStorefront();
  return successResponse({ category });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Category not found', 404);
  const category = await Category.findById(params.id);
  if (!category) return errorResponse('Category not found', 404);

  const publicId = category.image?.publicId;

  // Document first; the image is only deleted once nothing points at it
  await category.deleteOne();
  if (publicId) await deleteImage(publicId);

  revalidateStorefront();
  return successResponse({ message: 'Category deleted' });
});

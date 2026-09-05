export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CategorySchema } from '@/schemas/admin';

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  const category = await Category.findById(params.id).lean();
  if (!category) return errorResponse('Category not found', 404);
  return successResponse({ category });
});

export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  const category = await Category.findById(params.id);
  if (!category) return errorResponse('Category not found', 404);

  const { fields, files } = await parseFormData(req);

  const parsedFields = {
    name: fields.name?.trim() ?? category.name,
    description: fields.description?.trim() ?? category.description,
    isFeatured: fields.isFeatured !== undefined ? fields.isFeatured === 'true' : category.isFeatured,
    isHidden: fields.isHidden !== undefined ? fields.isHidden === 'true' : category.isHidden,
  };

  const validationResult = CategorySchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  // Handle image removal
  const removedImageId = fields.removedImageId;
  if (removedImageId && category.image?.publicId === removedImageId) {
    await deleteImage(removedImageId);
    category.image = undefined;
  }

  // Handle new image upload
  if (files.length > 0) {
    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }
    
    // Upload new image
    const result = await uploadImage(file.buffer, {
      folder: 'indian-mist/categories',
    });
    
    // Delete old image if it existed
    if (category.image?.publicId) {
      await deleteImage(category.image.publicId);
    }

    category.image = {
      url: result.url,
      publicId: result.publicId,
      alt: fields.imageAlt ?? '',
    };
  } else if (fields.imageAlt !== undefined && category.image) {
    category.image.alt = fields.imageAlt;
  }

  // Only update slug if name changed significantly (optional, but good for SEO consistency, actually usually better not to change slugs to avoid breaking links, but we'll allow it if explicitly needed or just keep the old slug). 
  // For safety, let's not update slug on name change unless explicitly requested. We'll leave the slug as is.
  
  category.name = parsedFields.name!;
  category.description = parsedFields.description;
  category.isFeatured = parsedFields.isFeatured;
  category.isHidden = parsedFields.isHidden;

  await category.save();

  return successResponse({ category });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  const category = await Category.findById(params.id);
  if (!category) return errorResponse('Category not found', 404);

  if (category.image?.publicId) {
    await deleteImage(category.image.publicId);
  }

  await category.deleteOne();

  return successResponse({ message: 'Category deleted' });
});

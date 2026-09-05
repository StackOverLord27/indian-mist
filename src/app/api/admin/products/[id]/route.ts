export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { uploadImage, deleteManyImages } from '@/lib/cloudinary';
import { ProductSchema } from '@/schemas/admin';

export const GET = withAdmin(async (req, context: any) => {
  const params = await context.params;
  const product = await Product.findById(params.id).lean();
  if (!product) return errorResponse('Product not found', 404);
  return successResponse({ product });
});

export const PUT = withAdmin(async (req, context: any) => {
  const params = await context.params;
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const { fields, files } = await parseFormData(req);

  // Step 1: Remove images by publicId
  const removeIds: string[] = JSON.parse(fields.removeImageIds ?? '[]');
  if (removeIds.length) {
    await deleteManyImages(removeIds);
    product.images = (product.images as any).filter(
      (img: any) => !removeIds.includes(img.publicId)
    );
  }

  // Step 2: Upload new images
  for (const [i, file] of files.entries()) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }
    const result = await uploadImage(file.buffer, {
      folder: 'indian-mist/products',
    });
    product.images.push({
      url: result.url,
      publicId: result.publicId,
      alt: fields[`newImageAlt_${i}`] ?? '',
      isPrimary: false,
    });
  }

  if (product.images.length === 0) {
    return errorResponse('Product must have at least one image', 400);
  }

  // Step 3: Update primary image
  if (fields.primaryImagePublicId) {
    product.images = (product.images as any).map((img: any) => ({
      ...img.toObject?.() ?? img,
      isPrimary: img.publicId === fields.primaryImagePublicId,
    }));
  }

  // Step 4: Update category cover image
  if (fields.categoryCoverImagePublicId) {
    const cover = (product.images as any).find(
      (img: any) => img.publicId === fields.categoryCoverImagePublicId
    );
    if (cover) product.categoryCoverImage = cover.url;
  }

  // Step 5: Update scalar fields
  const parseJSON = <T>(val: string | undefined, fb: T): T => {
    try { return val ? JSON.parse(val) : fb; }
    catch { return fb; }
  };

  const parsedFields = {
    name: fields.name?.trim() ?? product.name,
    category: fields.category ?? product.category,
    price: fields.price ? Number(fields.price) : product.price,
    originalPrice: fields.originalPrice ? Number(fields.originalPrice) : product.originalPrice,
    description: fields.description?.trim() ?? product.description,
    badge: fields.badge ?? product.badge ?? '',
    tags: fields.tags ? parseJSON(fields.tags, []) : product.tags,
    sizes: fields.sizes ? parseJSON(fields.sizes, []) : product.sizes,
    features: fields.features ? parseJSON(fields.features, []) : product.features,
    materials: fields.materials ? parseJSON(fields.materials, []) : product.materials,
  };

  const validationResult = ProductSchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err: any) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  Object.assign(product, parsedFields);

  await product.save();
  return successResponse({ product });
});

export const DELETE = withAdmin(async (req, context: any) => {
  const params = await context.params;
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const publicIds = (product.images as any[])
    .map(img => img.publicId)
    .filter(Boolean);
  await deleteManyImages(publicIds);

  await product.deleteOne();
  return successResponse({ message: 'Product deleted successfully' });
});

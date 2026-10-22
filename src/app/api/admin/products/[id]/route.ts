export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { uploadImage, deleteManyImages } from '@/lib/cloudinary';
import { ProductSchema } from '@/schemas/admin';
import { slugify } from '@/lib/slugify';
import { buildSizeStock } from '@/lib/size-stock';

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  const product = await Product.findById(params.id).lean();
  if (!product) return errorResponse('Product not found', 404);
  return successResponse({ product });
});

type StoredImage = { url: string; publicId: string; alt: string; isPrimary: boolean };

export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const { fields, files } = await parseFormData(req);

  // Work on a plain copy of the images, then save it back once at the end
  let images: StoredImage[] = product.toObject().images;

  // Step 1: Remove images by publicId
  const removeIds: string[] = JSON.parse(fields.removeImageIds ?? '[]');
  if (removeIds.length) {
    await deleteManyImages(removeIds);
    images = images.filter((img) => !removeIds.includes(img.publicId));
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
    images.push({
      url: result.url,
      publicId: result.publicId,
      alt: fields[`newImageAlt_${i}`] ?? '',
      isPrimary: false,
    });
  }

  if (images.length === 0) {
    return errorResponse('Product must have at least one image', 400);
  }

  // Step 3: Update primary image and order
  if (fields.imageOrder) {
    try {
      const order: string[] = JSON.parse(fields.imageOrder);
      images.sort((a, b) => {
        const ai = order.indexOf(a.publicId);
        const bi = order.indexOf(b.publicId);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      // First image is primary
      images = images.map((img, idx) => ({ ...img, isPrimary: idx === 0 }));
    } catch (e) {
      console.error('Failed to parse imageOrder', e);
    }
  } else if (fields.primaryImagePublicId) {
    images = images.map((img) => ({
      ...img,
      isPrimary: img.publicId === fields.primaryImagePublicId,
    }));
  }

  product.images = images;

  // Step 4: Update category cover image
  if (fields.categoryCoverImagePublicId) {
    const cover = images.find(
      (img) => img.publicId === fields.categoryCoverImagePublicId
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
    colorName: fields.colorName !== undefined ? fields.colorName.trim() : (product.colorName ?? ''),
    colorHex: fields.colorHex !== undefined ? fields.colorHex.trim() : (product.colorHex ?? ''),
    colorGroup: fields.colorGroup !== undefined ? slugify(fields.colorGroup) : (product.colorGroup ?? ''),
    features: fields.features ? parseJSON(fields.features, []) : product.features,
    materials: fields.materials ? parseJSON(fields.materials, []) : product.materials,
    careInstructions: fields.careInstructions ? parseJSON(fields.careInstructions, []) : product.careInstructions,
    shippingInfo: fields.shippingInfo ? parseJSON(fields.shippingInfo, undefined) : product.shippingInfo,
    isFeatured: fields.isFeatured !== undefined ? fields.isFeatured === 'true' : product.isFeatured,
    trackInventory: fields.trackInventory !== undefined ? fields.trackInventory === 'true' : (product.trackInventory ?? false),
    stockQuantity: fields.stockQuantity !== undefined ? Math.max(0, Math.floor(Number(fields.stockQuantity) || 0)) : (product.stockQuantity ?? 0),
  };

  // With stock tracking on and sizes chosen, stock is kept per size and the total is their sum
  const sizeStock = buildSizeStock(
    parsedFields.sizes ?? [],
    fields.sizeStock ? parseJSON(fields.sizeStock, {}) : Object.fromEntries((product.sizeStock ?? []).map((s) => [s.size, s.quantity])),
    parsedFields.trackInventory,
  );
  if (sizeStock.length) parsedFields.stockQuantity = sizeStock.reduce((n, s) => n + s.quantity, 0);

  const validationResult = ProductSchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  // A colour with no group yet joins the group named after the product
  if (parsedFields.colorName && !parsedFields.colorGroup) {
    parsedFields.colorGroup = slugify(parsedFields.name);
  }

  // The slug is left alone on edit so existing links keep working
  Object.assign(product, parsedFields, { sizeStock });

  await product.save();
  return successResponse({ product });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const publicIds = product.images
    .map(img => img.publicId)
    .filter(Boolean);
  await deleteManyImages(publicIds);

  await product.deleteOne();
  return successResponse({ message: 'Product deleted successfully' });
});

export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse, validationError, ApiError } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { uploadImage, deleteManyImages } from '@/lib/cloudinary';
import { ProductSchema } from '@/schemas/admin';
import { slugify } from '@/lib/slugify';
import { productCandidate, stockFor } from '@/lib/product-fields';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

const MAX_PRODUCT_IMAGES = 10;

export const GET = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Product not found', 404);
  const product = await Product.findById(params.id).lean();
  if (!product) return errorResponse('Product not found', 404);
  return successResponse({ product });
});

type StoredImage = { url: string; publicId: string; alt: string; isPrimary: boolean };

/** A list of strings sent as JSON in a form field (for example the ids to remove). */
function stringList(raw: string | undefined, name: string): string[] {
  if (raw === undefined || raw === '') return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(`${name} is not valid`, 400, { [name]: 'Not valid' });
  }
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new ApiError(`${name} must be a list of ids`, 400, { [name]: 'Must be a list of ids' });
  }
  return value;
}

/**
 * Updating a product, in this order (so Cloudinary and the database never disagree for long):
 *   1. validate the files and the fields, work out which images are removed (only ones that
 *      belong to this product) and refuse to leave the product without any image;
 *   2. upload the new files;
 *   3. save the product;
 *   4. only now delete the removed images from Cloudinary.
 * If anything fails after step 2 the files uploaded in this request are deleted again and the
 * product keeps all its old images.
 */
export const PUT = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Product not found', 404);
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const { fields, files } = await parseFormData(req);

  // 1. validate -----------------------------------------------------------------------------
  for (const file of files) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { images: validation.message! });
  }

  const current = product.toObject();
  const validated = ProductSchema.safeParse(productCandidate(fields, current));
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const existing: StoredImage[] = current.images;
  const owned = new Set(existing.map((img) => img.publicId));
  // Ids the browser sent that are not this product's images are ignored: they must never reach Cloudinary
  const removeIds = stringList(fields.removedImageIds, 'removedImageIds').filter((id) => owned.has(id));
  const kept = existing.filter((img) => !removeIds.includes(img.publicId));

  if (kept.length + files.length === 0) {
    return errorResponse('Product must have at least one image', 400, { images: 'Keep or add at least one image' });
  }
  if (kept.length + files.length > MAX_PRODUCT_IMAGES) {
    return errorResponse(`A product can have at most ${MAX_PRODUCT_IMAGES} images`, 400, { images: `At most ${MAX_PRODUCT_IMAGES} images` });
  }
  const imageOrder = stringList(fields.imageOrder, 'imageOrder');

  // 2. upload -------------------------------------------------------------------------------
  const uploaded: StoredImage[] = [];
  try {
    for (const [i, file] of files.entries()) {
      const result = await uploadImage(file.buffer, { folder: 'indian-mist/products' });
      uploaded.push({ url: result.url, publicId: result.publicId, alt: fields[`newImageAlt_${i}`] ?? '', isPrimary: false });
    }

    // Order, primary image and category cover (new images always come after the existing ones)
    let images: StoredImage[] = [...kept, ...uploaded];
    if (imageOrder.length) {
      const position = new Map(imageOrder.map((id, i) => [id, i]));
      images = images
        .map((img, i) => ({ img, key: position.get(img.publicId) ?? imageOrder.length + i }))
        .sort((a, b) => a.key - b.key)
        .map(({ img }) => img);
      // First image is primary
      images = images.map((img, idx) => ({ ...img, isPrimary: idx === 0 }));
    } else if (fields.primaryImageId && images.some((img) => img.publicId === fields.primaryImageId)) {
      images = images.map((img) => ({ ...img, isPrimary: img.publicId === fields.primaryImageId }));
    }
    if (!images.some((img) => img.isPrimary)) images = images.map((img, idx) => ({ ...img, isPrimary: idx === 0 }));

    const removedUrls = new Set(existing.filter((img) => removeIds.includes(img.publicId)).map((img) => img.url));
    const cover = fields.coverImageId ? images.find((img) => img.publicId === fields.coverImageId) : undefined;
    if (cover) {
      product.categoryCoverImage = cover.url;
    } else if (product.categoryCoverImage && removedUrls.has(product.categoryCoverImage)) {
      // The cover image is being deleted: fall back to the primary image rather than a dead link
      product.categoryCoverImage = images.find((img) => img.isPrimary)?.url ?? images[0].url;
    }

    // A colour with no group yet joins the group named after the product
    const colorGroup = parsed.colorName && !parsed.colorGroup ? slugify(parsed.name) : parsed.colorGroup;
    const stock = stockFor(parsed, fields, current);

    // The slug is left alone on edit so existing links keep working
    product.set({ ...parsed, colorGroup, ...stock, images });

    // 3. save -------------------------------------------------------------------------------
    await product.save();
  } catch (error) {
    // The product was not changed: put Cloudinary back to how it was
    if (uploaded.length) await deleteManyImages(uploaded.map((img) => img.publicId));
    throw error;
  }

  // 4. the database no longer points at the removed images, so delete them -----------------
  if (removeIds.length) await deleteManyImages(removeIds);

  revalidateStorefront();
  return successResponse({ product });
});

export const DELETE = withAdmin(async (req, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Product not found', 404);
  const product = await Product.findById(params.id);
  if (!product) return errorResponse('Product not found', 404);

  const publicIds = product.images.map((img) => img.publicId).filter(Boolean);

  // Document first; the images are only deleted once nothing points at them
  await product.deleteOne();
  if (publicIds.length) await deleteManyImages(publicIds);

  revalidateStorefront();
  return successResponse({ message: 'Product deleted successfully' });
});

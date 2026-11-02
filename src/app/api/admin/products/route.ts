export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse, validationError } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { uploadImage, deleteManyImages } from '@/lib/cloudinary';
import { ProductSchema } from '@/schemas/admin';
import { slugify, uniqueProductSlug } from '@/lib/slugify';
import { productCandidate, stockFor } from '@/lib/product-fields';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

const MAX_PRODUCT_IMAGES = 10;

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return successResponse({
    products, total, page,
    totalPages: Math.ceil(total / limit),
  });
});

/**
 * Creating a product: validate everything first, then upload, then save. If saving fails the
 * files uploaded in this request are deleted again.
 */
export const POST = withAdmin(async (req: NextRequest) => {
  const { fields, files } = await parseFormData(req);

  for (const file of files) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { images: validation.message! });
  }
  if (files.length === 0) {
    return errorResponse('Product must have at least one image', 400, { images: 'Add at least one image' });
  }
  if (files.length > MAX_PRODUCT_IMAGES) {
    return errorResponse(`A product can have at most ${MAX_PRODUCT_IMAGES} images`, 400, { images: `At most ${MAX_PRODUCT_IMAGES} images` });
  }

  const validated = ProductSchema.safeParse(productCandidate(fields));
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const colorGroup = parsed.colorGroup || (parsed.colorName ? slugify(parsed.name) : '');
  const stock = stockFor(parsed, fields);

  const uploadedImages: { url: string; publicId: string; alt: string; isPrimary: boolean }[] = [];
  try {
    for (const [i, file] of files.entries()) {
      const result = await uploadImage(file.buffer, { folder: 'indian-mist/products' });
      uploadedImages.push({
        url: result.url,
        publicId: result.publicId,
        alt: fields[`imageAlt_${i}`] ?? '',
        isPrimary: i === 0,
      });
    }

    const coverIdx = Number(fields.categoryCoverIndex ?? 0);
    const categoryCoverImage = uploadedImages[Number.isInteger(coverIdx) ? coverIdx : 0]?.url ?? uploadedImages[0].url;

    // Slug = name + colour, so colour variants of one product never collide. Two admins saving
    // the same name at once can both pick the same free slug: the unique index stops the second,
    // which then picks the next free one.
    for (let attempt = 0; ; attempt++) {
      const slug = await uniqueProductSlug(parsed.name, parsed.colorName ?? '', (s) => Product.exists({ slug: s }));
      try {
        const product = await Product.create({
          ...parsed,
          colorGroup,
          ...stock,
          slug,
          images: uploadedImages,
          categoryCoverImage,
        });
        revalidateStorefront();
        return successResponse({ product }, 201);
      } catch (error) {
        const duplicateSlug =
          (error as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000 &&
          (error as { keyPattern?: Record<string, unknown> }).keyPattern?.slug;
        if (!duplicateSlug || attempt >= 4) throw error;
      }
    }
  } catch (error) {
    if (uploadedImages.length) await deleteManyImages(uploadedImages.map((img) => img.publicId));
    throw error;
  }
});

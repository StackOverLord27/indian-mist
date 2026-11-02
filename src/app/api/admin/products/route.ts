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
import { parsePagination, paginationMeta, escapeRegex, searchTerm } from '@/lib/pagination';
import { PRODUCT_SORT } from '@/lib/product-sort';

const MAX_PRODUCT_IMAGES = 10;

// Only what the list and the pickers show; images are cut to the first one.
const LIST_PROJECTION = {
  name: 1, slug: 1, category: 1, price: 1, badge: 1, isActive: 1, colorName: 1,
  images: { $slice: 1 },
} as const;

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  const category = searchParams.get('category')?.trim();
  const search = searchTerm(searchParams);

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

  const [products, total] = await Promise.all([
    Product.find(filter, LIST_PROJECTION)
      .sort(PRODUCT_SORT)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return successResponse({ products, ...paginationMeta(total, pagination) });
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

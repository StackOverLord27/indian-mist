export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse, validationError } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CategorySchema } from '@/schemas/admin';
import { slugify } from '@/lib/slugify';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));

  const [categories, total] = await Promise.all([
    Category.find({})
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Category.countDocuments({}),
  ]);

  return successResponse({
    categories, total, page,
    totalPages: Math.ceil(total / limit),
  });
});

/** Validate, then upload, then save; a failed save deletes the file uploaded in this request. */
export const POST = withAdmin(async (req: NextRequest) => {
  const { fields, files } = await parseFormData(req);

  const validated = CategorySchema.safeParse({
    name: fields.name,
    description: fields.description,
    isFeatured: fields.isFeatured === 'true',
    isHidden: fields.isHidden === 'true',
  });
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const file = files[0];
  if (file) {
    const validation = validateImageFile(file);
    if (!validation.valid) return errorResponse(validation.message!, 400, { images: validation.message! });
  }

  let image: { url: string; publicId: string; alt: string } | undefined;
  try {
    if (file) {
      const result = await uploadImage(file.buffer, { folder: 'indian-mist/categories' });
      image = { url: result.url, publicId: result.publicId, alt: fields.imageAlt ?? '' };
    }

    // The unique index settles two admins saving the same name at once: the loser takes the next free slug
    const baseSlug = slugify(parsed.name) || 'category';
    for (let n = 0; ; n++) {
      let slug = n === 0 ? baseSlug : `${baseSlug}-${n}`;
      if (await Category.exists({ slug })) continue;
      try {
        const category = await Category.create({ ...parsed, slug, image });
        revalidateStorefront();
        return successResponse({ category }, 201);
      } catch (error) {
        const duplicateSlug =
          (error as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000 &&
          (error as { keyPattern?: Record<string, unknown> }).keyPattern?.slug;
        if (!duplicateSlug || n >= 20) throw error;
      }
    }
  } catch (error) {
    if (image) await deleteImage(image.publicId);
    throw error;
  }
});

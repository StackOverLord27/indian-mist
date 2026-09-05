export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { uploadImage } from '@/lib/cloudinary';
import { CategorySchema } from '@/schemas/admin';

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));

  const [categories, total] = await Promise.all([
    Category.find({})
      .sort({ createdAt: -1 })
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

export const POST = withAdmin(async (req) => {
  const { fields, files } = await parseFormData(req);

  const parsedFields = {
    name: fields.name?.trim(),
    description: fields.description?.trim(),
    isFeatured: fields.isFeatured === 'true',
    isHidden: fields.isHidden === 'true',
  };

  const validationResult = CategorySchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  let image: { url: string; publicId: string; alt: string } | undefined;

  if (files.length > 0) {
    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }
    const result = await uploadImage(file.buffer, {
      folder: 'indian-mist/categories',
    });
    image = {
      url: result.url,
      publicId: result.publicId,
      alt: fields.imageAlt ?? '',
    };
  }

  // Pre-generate slug from name if not provided (Mongoose pre-validate hook will also do this, but this handles potential duplicates)
  let baseSlug = parsedFields.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = baseSlug;
  let counter = 1;
  while (await Category.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const category = await Category.create({
    ...parsedFields,
    slug,
    image,
  });

  return successResponse({ category }, 201);
});

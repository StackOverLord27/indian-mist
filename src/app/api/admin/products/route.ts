export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { uploadImage } from '@/lib/cloudinary';
import { ProductSchema } from '@/schemas/admin';

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const filter: Record<string, any> = {};
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

export const POST = withAdmin(async (req) => {
  const { fields, files } = await parseFormData(req);

  // Parse JSON-encoded array/object fields from FormData
  const parseJSON = <T>(val: string | undefined, fallback: T): T => {
    try { return val ? JSON.parse(val) : fallback; }
    catch { return fallback; }
  };

  const parsedFields = {
    name: fields.name?.trim(),
    category: fields.category,
    price: Number(fields.price),
    originalPrice: fields.originalPrice ? Number(fields.originalPrice) : undefined,
    description: fields.description?.trim(),
    badge: fields.badge ?? '',
    tags: parseJSON(fields.tags, []),
    sizes: parseJSON(fields.sizes, []),
    features: parseJSON(fields.features, []),
    materials: parseJSON(fields.materials, []),
    isFeatured: fields.isFeatured === 'true',
  };

  const validationResult = ProductSchema.safeParse(parsedFields);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const uploadedImages: {
    url: string; publicId: string;
    alt: string; isPrimary: boolean;
  }[] = [];

  for (const [i, file] of files.entries()) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return errorResponse(validation.message!, 400);
    }
    const result = await uploadImage(file.buffer, {
      folder: 'indian-mist/products',
    });
    uploadedImages.push({
      url: result.url,
      publicId: result.publicId,
      alt: fields[`imageAlt_${i}`] ?? '',
      isPrimary: i === 0,
    });
  }

  const coverIdx = Number(fields.categoryCoverIndex ?? 0);
  const categoryCoverImage = uploadedImages[coverIdx]?.url ?? '';

  const product = await Product.create({
    ...parsedFields,
    badge: parsedFields.badge as "New" | "Sale" | "Sold Out" | "",
    images: uploadedImages,
    categoryCoverImage,
  });

  return successResponse({ product }, 201);
});

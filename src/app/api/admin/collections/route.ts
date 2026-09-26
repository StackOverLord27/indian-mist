export const runtime = 'nodejs';

import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Collection } from '@/models/collection.model';
import { CollectionSchema } from '@/schemas/admin';

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));

  const [collections, total] = await Promise.all([
    Collection.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('products')
      .lean(),
    Collection.countDocuments({}),
  ]);

  return successResponse({
    collections, total, page,
    totalPages: Math.ceil(total / limit),
  });
});

export const POST = withAdmin(async (req) => {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return errorResponse('Invalid JSON payload', 400);
  }

  const validationResult = CollectionSchema.safeParse(body);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const parsedFields = validationResult.data;

  let baseSlug = parsedFields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = baseSlug;
  let counter = 1;
  while (await Collection.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const collection = await Collection.create({
    ...parsedFields,
    slug,
  });

  return successResponse({ collection }, 201);
});

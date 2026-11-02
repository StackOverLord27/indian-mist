export const runtime = 'nodejs';

import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Collection } from '@/models/collection.model';
import { CollectionSchema } from '@/schemas/admin';
import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { parsePagination, paginationMeta } from '@/lib/pagination';

export const GET = withAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);

  // The list only shows how many products each collection has, so count them in the database
  // instead of loading the products.
  const [collections, total] = await Promise.all([
    Collection.aggregate([
      { $sort: { createdAt: -1, _id: 1 } },
      { $skip: pagination.skip },
      { $limit: pagination.limit },
      { $addFields: { productCount: { $size: { $ifNull: ['$products', []] } } } },
      { $project: { products: 0 } },
    ]),
    Collection.countDocuments({}),
  ]);

  return successResponse({ collections, ...paginationMeta(total, pagination) });
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

  revalidateStorefront();
  return successResponse({ collection }, 201);
});

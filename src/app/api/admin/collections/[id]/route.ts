export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Collection } from '@/models/collection.model';
import { CollectionSchema } from '@/schemas/admin';

export const GET = withAdmin(async (req, { params }) => {
  const { id } = await params;
  const collection = await Collection.findById(id).populate('products').lean();
  if (!collection) {
    return errorResponse('Collection not found', 404);
  }
  return successResponse({ collection });
});

export const PUT = withAdmin(async (req, { params }) => {
  const { id } = await params;
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

  const collection = await Collection.findByIdAndUpdate(
    id,
    { $set: validationResult.data },
    { new: true, runValidators: true }
  ).populate('products');

  if (!collection) {
    return errorResponse('Collection not found', 404);
  }

  return successResponse({ collection });
});

export const DELETE = withAdmin(async (req, { params }) => {
  const { id } = await params;
  const collection = await Collection.findByIdAndDelete(id);
  if (!collection) {
    return errorResponse('Collection not found', 404);
  }
  return successResponse({ message: 'Collection deleted successfully' });
});

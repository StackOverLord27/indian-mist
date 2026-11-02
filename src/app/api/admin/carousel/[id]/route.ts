export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, parseJsonBody, validateImageFile, successResponse, errorResponse, validationError } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CarouselUpdateSchema } from '@/schemas/admin';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

/**
 * Change an item. Only alt text, visibility and order can be changed this way; the image
 * itself can be replaced with a multipart request containing a file: the new file is uploaded,
 * the item saved, and only then is the old file deleted from Cloudinary.
 */
export const PUT = withAdmin(async (req: NextRequest, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Not found', 404);
  const item = await Carousel.findById(params.id);
  if (!item) return errorResponse('Not found', 404);

  const contentType = req.headers.get('content-type') ?? '';
  const oldPublicId = item.publicId;
  let newFile: Awaited<ReturnType<typeof parseFormData>>['files'][number] | undefined;
  let raw: Record<string, unknown>;

  if (contentType.includes('multipart/form-data')) {
    const { fields, files } = await parseFormData(req);
    newFile = files[0];
    raw = {
      ...(fields.alt !== undefined && { alt: fields.alt }),
      ...(fields.altText !== undefined && { altText: fields.altText }),
      ...(fields.isActive !== undefined && { isActive: fields.isActive === 'true' }),
      ...(fields.order !== undefined && { order: Number(fields.order) }),
    };
  } else {
    const body = await parseJsonBody(req);
    raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  const validated = CarouselUpdateSchema.safeParse(raw);
  if (!validated.success) return validationError(validated.error);
  const changes = validated.data;

  if (newFile) {
    const validation = validateImageFile(newFile);
    if (!validation.valid) return errorResponse(validation.message!, 400, { image: validation.message! });
  }

  let uploadedPublicId = '';
  try {
    if (newFile) {
      const result = await uploadImage(newFile.buffer, { folder: 'indian-mist/carousel' });
      uploadedPublicId = result.publicId;
      item.url = result.url;
      item.publicId = result.publicId;
    }
    const alt = changes.alt ?? changes.altText;
    if (alt !== undefined) item.alt = alt;
    if (changes.isActive !== undefined) item.isActive = changes.isActive;
    if (changes.order !== undefined) item.order = changes.order;

    await item.save();
  } catch (error) {
    if (uploadedPublicId) await deleteImage(uploadedPublicId);
    throw error;
  }

  if (uploadedPublicId && oldPublicId) await deleteImage(oldPublicId);

  revalidateStorefront();
  return successResponse({ item, image: item });
});

export const DELETE = withAdmin(async (req: NextRequest, context) => {
  const params = await context.params;
  if (!mongoose.isValidObjectId(params.id)) return errorResponse('Not found', 404);
  const item = await Carousel.findById(params.id);
  if (!item) return errorResponse('Not found', 404);

  const publicId = item.publicId;

  // Document first; the file is only deleted once nothing points at it
  await item.deleteOne();
  if (publicId) await deleteImage(publicId);

  revalidateStorefront();
  return successResponse({ message: 'Deleted' });
});

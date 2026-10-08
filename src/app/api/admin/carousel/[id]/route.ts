export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, successResponse, errorResponse } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CarouselSchema } from '@/schemas/admin';

export const PUT = withAdmin(async (req: NextRequest, context) => {
  const params = await context.params;
  const item = await Carousel.findById(params.id);
  if (!item) return errorResponse('Not found', 404);

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const { fields, files } = await parseFormData(req);
    
    if (files.length) {
      const fileValidation = validateImageFile(files[0]);
      if (!fileValidation.valid) {
        return errorResponse(fileValidation.message!, 400);
      }
      await deleteImage(item.publicId);
      const result = await uploadImage(files[0].buffer, {
        folder: 'indian-mist/carousel',
      });
      item.url = result.url;
      item.publicId = result.publicId;
    }
    
    if (fields.alt !== undefined) item.alt = fields.alt;
    if (fields.isActive !== undefined) item.isActive = fields.isActive === 'true';
    if (fields.order !== undefined) item.order = Number(fields.order);
    
  } else {
    const body = await req.json();
    
    const validationResult = CarouselSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400);
    }
    
    Object.assign(item, body);
  }

  await item.save();
  revalidatePath('/');
  return successResponse({ item });
});

export const DELETE = withAdmin(async (req: NextRequest, context) => {
  const params = await context.params;
  const item = await Carousel.findById(params.id);
  if (!item) return errorResponse('Not found', 404);
  
  await deleteImage(item.publicId);
  await item.deleteOne();
  
  revalidatePath('/');
  return successResponse({ message: 'Deleted' });
});

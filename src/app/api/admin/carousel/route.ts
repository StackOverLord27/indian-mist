export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, successResponse, errorResponse } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';
import { uploadImage } from '@/lib/cloudinary';
import { CarouselSchema } from '@/schemas/admin';

export const GET = withAdmin(async () => {
  const items = await Carousel.find().sort({ order: 1 }).lean();
  return successResponse({ images: items });
});

export const POST = withAdmin(async (req: NextRequest) => {
  const { fields, files } = await parseFormData(req);
  if (!files.length) {
    return errorResponse('Image file is required', 400);
  }
  
  const file = files[0];
  const fileValidation = validateImageFile(file);
  if (!fileValidation.valid) {
    return errorResponse(fileValidation.message!, 400);
  }

  const validationResult = CarouselSchema.safeParse({
    alt: fields.alt ?? fields.altText,
    isActive: fields.isActive === 'true' || fields.isActive === undefined,
  });

  if (!validationResult.success) {
    return errorResponse('Validation failed', 400);
  }
  
  const result = await uploadImage(file.buffer, {
    folder: 'indian-mist/carousel',
  });
  
  const last = await Carousel.findOne().sort({ order: -1 }).lean();
  
  const item = await Carousel.create({
    url: result.url,
    publicId: result.publicId,
    alt: validationResult.data.alt?.trim() ?? '',
    order: ((last as any)?.order ?? -1) + 1,
    isActive: validationResult.data.isActive,
  });
  
  revalidatePath('/');
  return successResponse({ image: item }, 201);
});

export const runtime = "nodejs";
// Uploads to Cloudinary can take a while (up to 10 images in one request); allow a full minute
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, successResponse, errorResponse, validationError } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { CarouselSchema } from '@/schemas/admin';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const GET = withAdmin(async () => {
  const items = await Carousel.find().sort({ order: 1 }).lean();
  return successResponse({ images: items });
});

/** Validate, then upload, then save; a failed save deletes the file uploaded in this request. */
export const POST = withAdmin(async (req: NextRequest) => {
  const { fields, files } = await parseFormData(req);
  if (!files.length) {
    return errorResponse('Image file is required', 400, { image: 'Choose an image' });
  }

  const file = files[0];
  const fileValidation = validateImageFile(file);
  if (!fileValidation.valid) {
    return errorResponse(fileValidation.message!, 400, { image: fileValidation.message! });
  }

  const validated = CarouselSchema.safeParse({
    alt: fields.alt ?? fields.altText,
    isActive: fields.isActive === 'true' || fields.isActive === undefined,
  });
  if (!validated.success) return validationError(validated.error);

  const result = await uploadImage(file.buffer, { folder: 'indian-mist/carousel' });
  try {
    const last = await Carousel.findOne().sort({ order: -1 }).lean<{ order?: number } | null>();
    const item = await Carousel.create({
      url: result.url,
      publicId: result.publicId,
      alt: validated.data.alt ?? '',
      order: (last?.order ?? -1) + 1,
      isActive: validated.data.isActive,
    });

    revalidateStorefront();
    return successResponse({ image: item }, 201);
  } catch (error) {
    await deleteImage(result.publicId);
    throw error;
  }
});

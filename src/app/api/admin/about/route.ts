export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, successResponse, errorResponse } from '@/lib/api-helpers';
import About from '@/models/about.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { AboutSchema } from '@/schemas/admin';

export const GET = withAdmin(async () => {
  const about = await About.findOne().lean();
  return successResponse({ about: about ?? {} });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') ?? '';
  const update: Record<string, any> = {};

  if (contentType.includes('multipart/form-data')) {
    const { fields, files } = await parseFormData(req);

    if (fields.mission) update.mission = JSON.parse(fields.mission);
    if (fields.drivesUs) update.drivesUs = JSON.parse(fields.drivesUs);
    if (fields.cta) update.cta = JSON.parse(fields.cta);

    if (files.length) {
      // Delete old team photo from Cloudinary if exists
      const existing = await About.findOne().select('teamPhoto').lean() as any;
      if (existing?.teamPhoto?.publicId) {
        await deleteImage(existing.teamPhoto.publicId);
      }
      const result = await uploadImage(files[0].buffer, {
        folder: 'indian-mist/about',
      });
      update.teamPhoto = {
        url: result.url,
        publicId: result.publicId,
        alt: fields.teamPhotoAlt ?? '',
      };
    }
  } else {
    Object.assign(update, await req.json());
  }
  
  const validationResult = AboutSchema.safeParse(update);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err: any) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const about = await About.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  );
  
  revalidatePath('/about');
  return successResponse({ about });
});

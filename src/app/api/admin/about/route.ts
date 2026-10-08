export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, successResponse, errorResponse } from '@/lib/api-helpers';
import About from '@/models/about.model';
import { uploadImage, deleteImage, deleteManyImages } from '@/lib/cloudinary';
import { AboutSchema } from '@/schemas/admin';

type AboutImages = {
  story?: { image?: { publicId?: string } };
  gallery?: { images?: { publicId?: string }[] };
  customSections?: { imagePublicId?: string }[];
  teamPhoto?: { publicId?: string };
};

// Every Cloudinary file the About page currently points to
function collectPublicIds(doc: AboutImages | null | undefined): Set<string> {
  const ids = [
    doc?.story?.image?.publicId,
    ...(doc?.gallery?.images ?? []).map((i) => i.publicId),
    ...(doc?.customSections ?? []).map((s) => s.imagePublicId),
    doc?.teamPhoto?.publicId,
  ];
  return new Set(ids.filter((id): id is string => !!id));
}

export const GET = withAdmin(async () => {
  const about = await About.findOne().lean();
  return successResponse({ about: about ?? {} });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') ?? '';
  const update: Record<string, unknown> = {};

  if (contentType.includes('multipart/form-data')) {
    const { fields, files } = await parseFormData(req);

    if (fields.mission) update.mission = JSON.parse(fields.mission);
    if (fields.drivesUs) update.drivesUs = JSON.parse(fields.drivesUs);
    if (fields.cta) update.cta = JSON.parse(fields.cta);

    if (files.length) {
      const fileValidation = validateImageFile(files[0]);
      if (!fileValidation.valid) {
        return errorResponse(fileValidation.message!, 400);
      }
      // Delete old team photo from Cloudinary if exists
      const existing = await About.findOne().select('teamPhoto').lean<{ teamPhoto?: { publicId?: string } } | null>();
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
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const before = await About.findOne().lean<AboutImages | null>();

  const about = await About.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  );
  
  // Delete photos that were replaced or removed, so nothing is left behind in Cloudinary.
  // A cleanup problem must never fail the save itself.
  try {
    const stillUsed = collectPublicIds(about.toObject() as AboutImages);
    const unused = [...collectPublicIds(before)].filter((id) => !stillUsed.has(id));
    if (unused.length) await deleteManyImages(unused);
  } catch (error) {
    console.error('About image cleanup failed:', error);
  }

  revalidatePath('/about');
  return successResponse({ about });
});

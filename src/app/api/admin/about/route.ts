export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, parseJsonBody, jsonFormField, validateImageFile, successResponse, errorResponse, validationError } from '@/lib/api-helpers';
import About from '@/models/about.model';
import { uploadImage, deleteManyImages, deleteImage } from '@/lib/cloudinary';
import { AboutSchema } from '@/schemas/admin';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

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

/**
 * Saves the sections the request contains (each section replaces the stored one; sections not
 * in the request are left alone). Images are uploaded by the admin page as soon as they are
 * picked, so the page sends only URLs and ids. After the save, every file the page used to
 * point at and no longer does is deleted from Cloudinary. A cleanup problem is logged and
 * never fails the save.
 */
export const PUT = withAdmin(async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') ?? '';
  const raw: Record<string, unknown> = {};
  let newTeamPhoto: Awaited<ReturnType<typeof parseFormData>>['files'][number] | undefined;
  let teamPhotoAlt = '';

  if (contentType.includes('multipart/form-data')) {
    const { fields, files } = await parseFormData(req);
    for (const key of ['mission', 'drivesUs', 'cta'] as const) {
      const value = jsonFormField<unknown>(fields, key);
      if (value !== undefined) raw[key] = value;
    }
    newTeamPhoto = files[0];
    teamPhotoAlt = fields.teamPhotoAlt ?? '';
    if (newTeamPhoto) {
      const validation = validateImageFile(newTeamPhoto);
      if (!validation.valid) return errorResponse(validation.message!, 400, { image: validation.message! });
    }
  } else {
    const body = await parseJsonBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('Request body must be an object', 400);
    }
    Object.assign(raw, body);
  }

  const validated = AboutSchema.safeParse(raw);
  if (!validated.success) return validationError(validated.error);
  // Only the validated, whitelisted data is saved
  const update: Record<string, unknown> = { ...validated.data };

  const before = await About.findOne().lean<AboutImages | null>();

  let uploadedPublicId = '';
  let about;
  try {
    if (newTeamPhoto) {
      const result = await uploadImage(newTeamPhoto.buffer, { folder: 'indian-mist/about' });
      uploadedPublicId = result.publicId;
      update.teamPhoto = { url: result.url, publicId: result.publicId, alt: teamPhotoAlt };
    }
    about = await About.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  } catch (error) {
    if (uploadedPublicId) await deleteImage(uploadedPublicId);
    throw error;
  }

  // Saved: delete the photos that were replaced or removed, so nothing is left behind in Cloudinary.
  try {
    const stillUsed = collectPublicIds(about.toObject() as AboutImages);
    const unused = [...collectPublicIds(before)].filter((id) => !stillUsed.has(id));
    if (unused.length) await deleteManyImages(unused);
  } catch (error) {
    console.error('About image cleanup failed:', error);
  }

  revalidateStorefront();
  return successResponse({ about });
});

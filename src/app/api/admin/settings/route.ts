import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';
import { SettingsSchema } from '@/schemas/admin';
import { deleteImage } from '@/lib/cloudinary';
import { isAssetReferenced, publicIdFromUrl } from '@/lib/image-assets';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const GET = withAdmin(async () => {
  const settings = await Settings.findOne().lean();
  return successResponse({ settings: settings ?? {} });
});

/**
 * Turns { heroSettings: { ecoBadge: { text } }, tagline } into
 * { 'heroSettings.ecoBadge.text': ..., tagline: ... }: objects are walked down to their values
 * (arrays and primitives are saved whole), so an update that mentions one field of a section
 * leaves that section's other fields alone.
 */
function toDotPaths(value: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (v && typeof v === 'object' && !Array.isArray(v)) toDotPaths(v as Record<string, unknown>, path, out);
    else out[path] = v;
  }
  return out;
}

/**
 * Saves only the settings sections the request contains, and only validated data. Each admin
 * page sends just the sections it owns, so saving one page can never overwrite another's.
 * Unknown keys, _id, timestamps and sizeChart (which has its own endpoint) are ignored.
 */
export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await parseJsonBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('Request body must be an object', 400);
  }

  const validated = SettingsSchema.safeParse(body);
  if (!validated.success) return validationError(validated.error);
  const parsed = validated.data;

  const update = toDotPaths(parsed as Record<string, unknown>);
  if (Object.keys(update).length === 0) {
    return errorResponse('No settings to save', 400);
  }

  // The homepage image may be replaced or removed by this save
  const brandStory = parsed.brandStorySettings;
  const touchesBrandImage = !!brandStory && (brandStory.imageUrl !== undefined || brandStory.imagePublicId !== undefined);
  const before = touchesBrandImage
    ? await Settings.findOne().select('brandStorySettings').lean<{ brandStorySettings?: { imageUrl?: string; imagePublicId?: string } } | null>()
    : null;

  // Keep the id in step with the URL, also for pages that only send the URL
  if (brandStory && brandStory.imageUrl !== undefined && brandStory.imagePublicId === undefined) {
    update['brandStorySettings.imagePublicId'] = publicIdFromUrl(brandStory.imageUrl) ?? '';
  }

  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  // Saved: delete the previous brand story image if it is no longer used.
  // Old documents stored only the URL: the id is worked out from it (our own URLs only).
  if (touchesBrandImage) {
    const oldId = before?.brandStorySettings?.imagePublicId || publicIdFromUrl(before?.brandStorySettings?.imageUrl);
    const newId = settings.brandStorySettings?.imagePublicId || '';
    if (oldId && oldId !== newId && !(await isAssetReferenced(oldId))) {
      await deleteImage(oldId);
    }
  }

  revalidateStorefront();
  return successResponse({ settings });
});

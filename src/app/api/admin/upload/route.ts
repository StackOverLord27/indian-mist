export const runtime = 'nodejs';
// Uploads to Cloudinary can take a while (up to 10 images in one request); allow a full minute
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, parseFormData, parseJsonBody, validateImageFile, errorResponse, successResponse, validationError } from '@/lib/api-helpers';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { ASSET_FOLDER_PREFIX, isAssetReferenced } from '@/lib/image-assets';

// The admin pages that upload as soon as a file is picked (About page, homepage brand story)
const UPLOAD_CONTEXTS = ['settings', 'about', 'brand-story'] as const;

export const POST = withAdmin(async (req: NextRequest) => {
  const { files, fields } = await parseFormData(req);

  if (!files.length) {
    return errorResponse('No image file provided', 400, { file: 'Choose an image' });
  }

  const file = files[0];
  const validation = validateImageFile(file);

  if (!validation.valid) {
    return errorResponse(validation.message!, 400, { file: validation.message! });
  }

  // Determine the folder based on the context, defaulting to 'settings'
  const context = fields.context || 'settings';
  if (!(UPLOAD_CONTEXTS as readonly string[]).includes(context)) {
    return errorResponse('Unknown upload context', 400, { context: 'Not allowed' });
  }

  try {
    const result = await uploadImage(file.buffer, { folder: `${ASSET_FOLDER_PREFIX}${context}` });
    return successResponse({
      url: result.url,
      publicId: result.publicId
    }, 201);
  } catch (error) {
    console.error('Upload Error:', error);
    return errorResponse('Failed to upload image', 500);
  }
});

const DiscardSchema = z.object({ publicId: z.string().min(1).max(300) });

/**
 * Throws away a file that was uploaded when it was picked but never saved (the admin picked
 * another one, removed it, or left). Refuses anything outside this app's folder and anything
 * a document still points at, so it can never remove an image that is in use.
 */
export const DELETE = withAdmin(async (req: NextRequest) => {
  const parsed = DiscardSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);
  const { publicId } = parsed.data;

  if (!publicId.startsWith(ASSET_FOLDER_PREFIX)) {
    return errorResponse('That file does not belong to this site', 400, { publicId: 'Not allowed' });
  }
  if (await isAssetReferenced(publicId)) {
    return errorResponse('This image is still in use and was not deleted', 409);
  }

  const result = await deleteImage(publicId);
  if (!result.ok) return errorResponse('Could not delete the image, try again', 502);
  return successResponse({ deleted: true });
});

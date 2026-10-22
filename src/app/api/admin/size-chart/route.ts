export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, successResponse, errorResponse } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';
import { uploadImage, deleteImage } from '@/lib/cloudinary';

type StoredChart = { sizeChart?: { url?: string; publicId?: string } } | null;

export const GET = withAdmin(async () => {
  const settings = await Settings.findOne().select('sizeChart').lean<StoredChart>();
  return successResponse({ sizeChart: settings?.sizeChart ?? {} });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const { files } = await parseFormData(req);
  if (!files.length) {
    return errorResponse('Image file is required', 400);
  }
  const validation = validateImageFile(files[0]);
  if (!validation.valid) {
    return errorResponse(validation.message!, 400);
  }

  const existing = await Settings.findOne().select('sizeChart').lean<StoredChart>();
  const result = await uploadImage(files[0].buffer, { folder: 'indian-mist/size-chart' });

  await Settings.findOneAndUpdate(
    {},
    { $set: { sizeChart: { url: result.url, publicId: result.publicId } } },
    { upsert: true }
  );
  if (existing?.sizeChart?.publicId) {
    await deleteImage(existing.sizeChart.publicId);
  }

  revalidatePath('/products/[slug]', 'page');
  return successResponse({ sizeChart: { url: result.url, publicId: result.publicId } });
});

export const DELETE = withAdmin(async () => {
  const existing = await Settings.findOne().select('sizeChart').lean<StoredChart>();
  await Settings.findOneAndUpdate({}, { $set: { sizeChart: { url: '', publicId: '' } } });
  if (existing?.sizeChart?.publicId) {
    await deleteImage(existing.sizeChart.publicId);
  }
  revalidatePath('/products/[slug]', 'page');
  return successResponse({ sizeChart: {} });
});

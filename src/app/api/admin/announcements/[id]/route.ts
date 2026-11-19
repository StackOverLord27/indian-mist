import mongoose from 'mongoose';
import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';
import { AnnouncementUpdateSchema } from '@/schemas/admin';

// Edit the text and/or switch an announcement on or off (PATCH is the same as PUT).
export const PUT = withAdmin(async (req: NextRequest, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return errorResponse('Not found', 404);

  const parsed = AnnouncementUpdateSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  const item = await Announcement.findByIdAndUpdate(
    id,
    { $set: parsed.data },
    { returnDocument: 'after', runValidators: true }
  );
  if (!item) return errorResponse('Not found', 404);

  revalidateStorefront();
  return successResponse({ announcement: item });
});

export const PATCH = PUT;

export const DELETE = withAdmin(async (_req: NextRequest, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return errorResponse('Not found', 404);

  const item = await Announcement.findByIdAndDelete(id);
  if (!item) return errorResponse('Not found', 404);

  revalidateStorefront();
  return successResponse({ message: 'Deleted' });
});

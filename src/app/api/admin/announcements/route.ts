import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';
import { AnnouncementSchema } from '@/schemas/admin';

// Oldest first: the same order the storefront bar uses.
export const GET = withAdmin(async () => {
  const items = await Announcement.find().sort({ createdAt: 1, _id: 1 }).limit(200).lean();
  return successResponse({ announcements: items });
});

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = AnnouncementSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  const item = await Announcement.create(parsed.data);

  revalidateStorefront();
  return successResponse({ announcement: item }, 201);
});

import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';
import { AnnouncementSchema } from '@/schemas/admin';

export const GET = withAdmin(async () => {
  const items = await Announcement.find().sort({ order: 1 }).lean();
  return successResponse({ announcements: items });
});

export const POST = withAdmin(async (req: NextRequest) => {
  const body = await req.json();
  
  const validationResult = AnnouncementSchema.safeParse(body);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const { text, link, linkText, isActive } = validationResult.data;

  const last = await Announcement.findOne().sort({ order: -1 }).lean<{ order?: number } | null>();
  const item = await Announcement.create({
    text: text.trim(),
    link: link?.trim() ?? '',
    linkText: linkText?.trim() ?? '',
    isActive: isActive ?? true,
    order: (last?.order ?? -1) + 1,
  });
  
  revalidatePath('/');
  return successResponse({ announcement: item }, 201);
});

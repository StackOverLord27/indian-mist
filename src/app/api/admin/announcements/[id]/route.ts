import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';
import { AnnouncementSchema } from '@/schemas/admin';

export const PUT = withAdmin(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const body = await req.json();

  const validationResult = AnnouncementSchema.partial().safeParse(body);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const item = await Announcement.findByIdAndUpdate(
    id,
    { $set: validationResult.data },
    { returnDocument: 'after', runValidators: true }
  );
  if (!item) return errorResponse('Not found', 404);
  
  revalidatePath('/');
  return successResponse({ announcement: item });
});

export const PATCH = PUT;

export const DELETE = withAdmin(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const item = await Announcement.findByIdAndDelete(id);
  if (!item) return errorResponse('Not found', 404);
  
  revalidatePath('/');
  return successResponse({ message: 'Deleted' });
});

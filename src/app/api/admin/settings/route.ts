import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';
import { SettingsSchema } from '@/schemas/admin';

export const GET = withAdmin(async () => {
  const settings = await Settings.findOne().lean();
  return successResponse({ settings: settings ?? {} });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await req.json();
  
  const validationResult = SettingsSchema.safeParse(body);
  if (!validationResult.success) {
    const errors: Record<string, string> = {};
    validationResult.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: body },
    { upsert: true, new: true, runValidators: true }
  );
  
  revalidatePath('/');
  revalidatePath('/about');
  revalidatePath('/contact');
  revalidatePath('/checkout');
  return successResponse({ settings });
});

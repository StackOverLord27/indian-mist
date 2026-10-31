export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdmin, successResponse, errorResponse } from '@/lib/api-helpers';
import LegalPage from '@/models/legal-page.model';
import { isLegalSlug } from '@/lib/legal-pages';
import { sanitizeRichText } from '@/lib/sanitize';

const LegalPageSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().max(200_000),
});

export const GET = withAdmin(async (_req, { params }) => {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return errorResponse('Page not found', 404);
  const page = await LegalPage.findOne({ slug }).lean();
  return successResponse({ page: page ?? null });
});

export const PUT = withAdmin(async (req, { params }) => {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return errorResponse('Page not found', 404);

  const parsed = LegalPageSchema.safeParse(await req.json());
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      errors[err.path.join('.')] = err.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }

  const page = await LegalPage.findOneAndUpdate(
    { slug },
    { $set: { title: parsed.data.title, content: sanitizeRichText(parsed.data.content) } },
    { upsert: true, new: true, runValidators: true }
  );

  revalidatePath(`/${slug}`);
  return successResponse({ page });
});

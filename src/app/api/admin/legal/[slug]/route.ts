export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { z } from 'zod';
import { withAdmin, successResponse, errorResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
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

  const parsed = LegalPageSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  const page = await LegalPage.findOneAndUpdate(
    { slug },
    { $set: { title: parsed.data.title, content: sanitizeRichText(parsed.data.content) } },
    { upsert: true, new: true, runValidators: true }
  );

  revalidatePath(`/${slug}`);
  // The footer links and the sitemap list the optional policy pages only while they have text
  revalidateStorefront();
  revalidatePath('/sitemap.xml');
  return successResponse({ page });
});

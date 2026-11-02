import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse, parseJsonBody } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const PUT = withAdmin(async (req: NextRequest) => {
  const orderedIds = ((await parseJsonBody(req)) as { orderedIds?: unknown } | null)?.orderedIds;

  if (!Array.isArray(orderedIds)) {
    return errorResponse('orderedIds must be an array', 400);
  }

  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      Category.findByIdAndUpdate(id, { order: index })
    )
  );

  revalidateStorefront();
  return successResponse({ message: 'Reordered successfully' });
});

import { NextRequest } from 'next/server';
import { withAdmin, successResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { ReorderSchema, reorderPage } from '@/lib/reorder';
import { CATEGORY_SORT } from '@/lib/category-sort';

/** Same contract as the products reorder: the ids must be exactly the categories at `offset`, else 409. */
export const PUT = withAdmin(async (req: NextRequest) => {
  const parsed = ReorderSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  await reorderPage(Category, CATEGORY_SORT, parsed.data.orderedIds, parsed.data.offset);

  revalidateStorefront();
  return successResponse({ message: 'Reordered successfully' });
});

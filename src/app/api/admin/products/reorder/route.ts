import { NextRequest } from 'next/server';
import { withAdmin, successResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { PRODUCT_SORT } from '@/lib/product-sort';
import { ReorderSchema, reorderPage } from '@/lib/reorder';

/**
 * Body: { orderedIds: string[] (one page, in the new order), offset: number (where that page starts) }.
 * 409 when the ids are not exactly the products at that position any more. See lib/reorder.ts.
 */
export const PUT = withAdmin(async (req: NextRequest) => {
  const parsed = ReorderSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  await reorderPage(Product, PRODUCT_SORT, parsed.data.orderedIds, parsed.data.offset);

  revalidateStorefront();
  return successResponse({ message: 'Reordered successfully' });
});

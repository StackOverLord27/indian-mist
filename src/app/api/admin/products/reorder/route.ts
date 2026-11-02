import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';
import { revalidateStorefront } from '@/lib/revalidate-storefront';

export const PUT = withAdmin(async (req: NextRequest) => {
  const { orderedIds } = await req.json();

  if (!Array.isArray(orderedIds)) {
    return successResponse({ message: 'orderedIds must be an array' }, 400);
  }

  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      Product.findByIdAndUpdate(id, { order: index })
    )
  );

  revalidateStorefront();
  return successResponse({ message: 'Reordered successfully' });
});

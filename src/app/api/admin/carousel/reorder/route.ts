import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse, errorResponse, parseJsonBody } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = (await parseJsonBody(req)) as { items?: { id: string; order: number }[]; orderedIds?: string[] } | null;
  let items = body?.items;

  if (!items && Array.isArray(body?.orderedIds)) {
    items = body.orderedIds.map((id: string, idx: number) => ({ id, order: idx }));
  }
  if (!Array.isArray(items)) {
    return errorResponse('orderedIds must be an array', 400);
  }

  await Promise.all(
    items.map(({ id, order }) =>
      Carousel.findByIdAndUpdate(id, { order })
    )
  );
  
  revalidateStorefront();
  return successResponse({ message: 'Reordered' });
});

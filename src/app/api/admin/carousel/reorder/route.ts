import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await req.json();
  let items: { id: string; order: number }[] = body.items;
  
  if (!items && Array.isArray(body.orderedIds)) {
    items = body.orderedIds.map((id: string, idx: number) => ({ id, order: idx }));
  }
  
  if (items && Array.isArray(items)) {
    await Promise.all(
      items.map(({ id, order }) =>
        Carousel.findByIdAndUpdate(id, { order })
      )
    );
  }
  
  revalidatePath('/');
  return successResponse({ message: 'Reordered' });
});

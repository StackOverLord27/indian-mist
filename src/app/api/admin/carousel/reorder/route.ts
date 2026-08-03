import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';

export const PUT = withAdmin(async (req: NextRequest) => {
  const { items }: { items: { id: string; order: number }[] } = await req.json();
  
  await Promise.all(
    items.map(({ id, order }) =>
      Carousel.findByIdAndUpdate(id, { order })
    )
  );
  
  revalidatePath('/');
  return successResponse({ message: 'Reordered' });
});

import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';
import { Category } from '@/models/category.model';
import { revalidatePath } from 'next/cache';

export const PUT = withAdmin(async (req: NextRequest) => {
  const { orderedIds } = await req.json();

  if (!Array.isArray(orderedIds)) {
    return successResponse({ message: 'orderedIds must be an array' }, 400);
  }

  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      Category.findByIdAndUpdate(id, { order: index })
    )
  );

  revalidatePath('/products');
  revalidatePath('/');
  return successResponse({ message: 'Reordered successfully' });
});

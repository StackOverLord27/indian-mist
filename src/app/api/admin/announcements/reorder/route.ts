import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';

export const PUT = withAdmin(async (req: NextRequest) => {
  const { items }: { items: { id: string; order: number }[] } = await req.json();
  
  await Promise.all(
    items.map(({ id, order }) =>
      Announcement.findByIdAndUpdate(id, { order })
    )
  );
  
  revalidateStorefront();
  return successResponse({ message: 'Reordered' });
});

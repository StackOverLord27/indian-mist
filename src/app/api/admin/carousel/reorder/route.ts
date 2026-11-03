import { revalidateStorefront } from '@/lib/revalidate-storefront';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withAdmin, successResponse, parseJsonBody, validationError } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';

// The slides page sends the new order as a list of ids (the only shape any caller uses).
const CarouselReorderSchema = z.object({
  orderedIds: z
    .array(z.string().refine((id) => mongoose.isValidObjectId(id), 'Not a valid id'))
    .min(1, 'Nothing to reorder')
    .max(100, 'At most 100 slides can be reordered at once')
    .refine((ids) => new Set(ids).size === ids.length, 'An id appears twice'),
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const parsed = CarouselReorderSchema.safeParse(await parseJsonBody(req));
  if (!parsed.success) return validationError(parsed.error);

  // One database call, all or nothing for validity: every id was checked above
  await Carousel.bulkWrite(
    parsed.data.orderedIds.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })),
  );

  revalidateStorefront();
  return successResponse({ message: 'Reordered' });
});

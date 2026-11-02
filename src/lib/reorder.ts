import type { Model } from 'mongoose';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ApiError } from '@/lib/api-helpers';
import { MAX_PAGE_SIZE } from '@/lib/pagination';

export const ReorderSchema = z.object({
  orderedIds: z
    .array(z.string().refine((id) => mongoose.isValidObjectId(id), 'Not a valid id'))
    .min(1, 'Nothing to reorder')
    .max(MAX_PAGE_SIZE, `At most ${MAX_PAGE_SIZE} items can be reordered at once`),
  /** Position (0-based) of the first id in the complete ordering */
  offset: z.number().int().min(0).default(0),
});

/**
 * Moves items around inside one page of a list and renumbers the whole list.
 *
 * The browser only knows one page. So it sends that page's ids in their new order plus the
 * page's offset, and we check that those ids are exactly the items currently at that position
 * of the full ordering. If another admin added, deleted or moved something in the meantime they
 * will not match, and the answer is 409 so nothing is shuffled based on a stale view.
 * Then the new order is put in place of that slice and every item gets order = its position,
 * in a single bulkWrite (this also fixes lists where everything had order 0).
 */
export async function reorderPage<T extends { order?: number }>(
  model: Model<T>,
  sort: Record<string, 1 | -1>,
  orderedIds: string[],
  offset: number,
): Promise<{ changed: number }> {
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new ApiError('The list contains the same item twice', 400);
  }

  const all = await model.find({}).sort(sort).select('_id order').lean<{ _id: mongoose.Types.ObjectId; order?: number }[]>();
  const current = all.slice(offset, offset + orderedIds.length).map((d) => String(d._id));
  const expected = new Set(current);
  if (current.length !== orderedIds.length || orderedIds.some((id) => !expected.has(id))) {
    throw new ApiError('The list has changed since you opened it. Please refresh and try again.', 409);
  }

  const newOrder = [
    ...all.slice(0, offset).map((d) => String(d._id)),
    ...orderedIds,
    ...all.slice(offset + orderedIds.length).map((d) => String(d._id)),
  ];
  const oldOrderById = new Map(all.map((d) => [String(d._id), d.order]));

  const ops = newOrder.flatMap((id, position) =>
    oldOrderById.get(id) === position
      ? []
      : [{ updateOne: { filter: { _id: id }, update: { $set: { order: position } } } }],
  );
  if (ops.length) await model.bulkWrite(ops as never, { ordered: false });
  return { changed: ops.length };
}

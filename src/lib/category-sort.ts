/** Admin category order, with _id as the final tie-breaker so pages and reordering are stable. */
export const CATEGORY_SORT = { order: 1, createdAt: -1, _id: 1 } as const;

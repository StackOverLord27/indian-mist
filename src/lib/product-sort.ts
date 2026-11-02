/**
 * The ONE order products are listed in: the admin's manual order, then newest first, then _id
 * as the final tie-breaker. Without the last part, products that share an order and a creation
 * time could swap places between two requests, so pagination would repeat or skip them.
 * Used by the admin list, the reorder route and the public product listing.
 */
export const PRODUCT_SORT = { order: 1, createdAt: -1, _id: 1 } as const;

/** Any other sort the storefront offers must also end in _id for the same reason. */
export const withIdTieBreaker = (sort: Record<string, 1 | -1>): Record<string, 1 | -1> =>
  '_id' in sort ? sort : { ...sort, _id: 1 };

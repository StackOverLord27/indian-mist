export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { withAdmin, successResponse } from '@/lib/api-helpers';
import { Product } from '@/models/product.model';

const MAX_GROUPS = 500;

/** Every distinct, non-empty colour group in use: suggestions for the product form. */
export const GET = withAdmin(async () => {
  const groups = (await Product.distinct('colorGroup', { colorGroup: { $nin: ['', null] } })) as string[];
  const colorGroups = groups
    .filter((g) => typeof g === 'string' && g.trim() !== '')
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_GROUPS);
  return successResponse({ colorGroups });
});

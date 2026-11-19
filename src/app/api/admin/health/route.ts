import { withAdmin, successResponse } from '@/lib/api-helpers';
import { getOrdersIndexHealth } from '@/lib/db-health';

/** What the dashboard shows as a warning. Cached for 10 minutes per server instance (db-health.ts). */
export const GET = withAdmin(async () => {
  const ordersIndex = await getOrdersIndexHealth();
  return successResponse({ ordersIndex: { ok: ordersIndex.ok, problem: ordersIndex.problem ?? null } });
});

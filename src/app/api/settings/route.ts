// Always read live: the checkout page shows the shipping fee from here, and the server charges the
// value in the database, so a cached copy could show a different fee than the one charged.
// (Without this, a route handler that reads no request data is prerendered at build time.)
export const dynamic = 'force-dynamic';

import { withDB, successResponse } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';

export const GET = withDB(async () => {
  const settings = await Settings.findOne().lean();
  
  if (settings?.pricingSettings?.promoCodes) {
    delete settings.pricingSettings.promoCodes;
  }
  
  return successResponse({ settings: settings ?? {} });
});

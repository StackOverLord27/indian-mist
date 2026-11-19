// Always read live: the checkout page shows the shipping fee from here, and the server charges the
// value in the database, so a cached copy could show a different fee than the one charged.
// (Without this, a route handler that reads no request data is prerendered at build time.)
export const dynamic = 'force-dynamic';

import { withDB, successResponse } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';
import { resolveShippingRules } from '@/lib/shipping-rules';

export const GET = withDB(async () => {
  const settings = await Settings.findOne().lean();
  
  if (settings?.pricingSettings?.promoCodes) {
    delete settings.pricingSettings.promoCodes;
  }
  
  // The shipping rules the server will charge (saved values, or its last-resort values when none are
  // saved), so the cart and checkout show exactly those numbers and never invent their own.
  const shippingRules = resolveShippingRules(settings?.pricingSettings);
  return successResponse({ settings: settings ?? {}, shippingRules });
});

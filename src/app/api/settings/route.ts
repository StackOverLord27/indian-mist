import { NextRequest } from 'next/server';
import { withDB, successResponse } from '@/lib/api-helpers';
import Settings from '@/models/settings.model';

export const GET = withDB(async () => {
  const settings = await Settings.findOne().lean();
  
  if (settings?.pricingSettings?.promoCodes) {
    delete settings.pricingSettings.promoCodes;
  }
  
  return successResponse({ settings: settings ?? {} });
});

export const revalidate = 300;

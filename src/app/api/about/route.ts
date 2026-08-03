import { NextRequest } from 'next/server';
import { withDB, successResponse } from '@/lib/api-helpers';
import About from '@/models/about.model';

export const GET = withDB(async () => {
  const about = await About.findOne().lean();
  return successResponse({ about: about ?? {} });
});

export const revalidate = 300;

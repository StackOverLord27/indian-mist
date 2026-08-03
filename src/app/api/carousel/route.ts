import { NextRequest } from 'next/server';
import { withDB, successResponse } from '@/lib/api-helpers';
import Carousel from '@/models/carousel.model';

export const GET = withDB(async () => {
  const images = await Carousel
    .find({ isActive: true })
    .sort({ order: 1 })
    .select('url alt order')
    .lean();
  return successResponse({ images });
});

export const revalidate = 60;

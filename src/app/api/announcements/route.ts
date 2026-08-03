import { NextRequest } from 'next/server';
import { withDB, successResponse } from '@/lib/api-helpers';
import Announcement from '@/models/announcement.model';

export const GET = withDB(async () => {
  const announcements = await Announcement
    .find({ isActive: true })
    .sort({ order: 1 })
    .select('text link linkText')
    .lean();
  return successResponse({ announcements });
});

export const revalidate = 60;

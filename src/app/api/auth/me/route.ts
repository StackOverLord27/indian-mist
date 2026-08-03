import { NextRequest } from 'next/server';
import { withAdmin, successResponse } from '@/lib/api-helpers';

export const GET = withAdmin(async (req: NextRequest, context) => {
  return successResponse({
    user: {
      id: context.userId,
      email: context.email,
      role: 'admin',
    },
  });
});

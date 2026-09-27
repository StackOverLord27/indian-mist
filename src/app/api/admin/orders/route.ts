import { NextRequest } from 'next/server';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Order } from '@/models/order.model';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query: any = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }

    // Exclude PENDING orders since they are unpaid checkouts that failed/abandoned
    if (!status || status === 'ALL') {
      query.status = { $ne: 'PENDING' };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return successResponse({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return errorResponse('Failed to fetch orders', 500);
  }
});

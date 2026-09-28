import { NextRequest } from 'next/server';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Order } from '@/models/order.model';

export const PATCH = withAdmin(async (req: NextRequest, context: any) => {
  try {
    const resolvedParams = await Promise.resolve(context?.params);
    const id = resolvedParams?.id;
    if (!id) return errorResponse('Order ID required', 400);

    const body = await req.json();
    const { status } = body;

    const validStatuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return errorResponse('Invalid status', 400);
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return errorResponse('Order not found', 404);
    }

    return successResponse({ order, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return errorResponse('Failed to update order status', 500);
  }
});

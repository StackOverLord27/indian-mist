import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Order } from '@/models/order.model';
import { Product } from '@/models/product.model';

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const PATCH = withAdmin(async (req: NextRequest, context) => {
  const { id } = await context.params;
  if (!id || !mongoose.isValidObjectId(id)) return errorResponse('Invalid order ID', 400);

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid request', 400);
  }

  const status = typeof body.status === 'string' ? body.status : '';
  if (!VALID_STATUSES.includes(status)) {
    return errorResponse('Invalid status', 400);
  }

  // A cancelled order is final: its stock has already been returned, so it can't be revived.
  // The status filter makes the change atomic, so a double click can't restock twice.
  const previous = await Order.findOneAndUpdate(
    { _id: id, status: { $ne: 'CANCELLED' } },
    { status },
    { new: false },
  );

  if (!previous) {
    const exists = await Order.exists({ _id: id });
    if (!exists) return errorResponse('Order not found', 404);
    return errorResponse('A cancelled order cannot be changed', 409);
  }

  // Return stock for tracked products when a paid order is cancelled
  if (status === 'CANCELLED' && previous.paymentStatus === 'PAID') {
    for (const item of previous.items) {
      await Product.updateOne(
        { _id: item.productId, trackInventory: true },
        { $inc: { stockQuantity: item.quantity } },
      );
      // Stock is back, so the automatic "Sold Out" label no longer applies
      await Product.updateOne(
        { _id: item.productId, trackInventory: true, badge: 'Sold Out', stockQuantity: { $gt: 0 } },
        { $set: { badge: '' } },
      );
    }
  }

  const order = await Order.findById(id);
  return successResponse({ order, message: 'Status updated successfully' });
});

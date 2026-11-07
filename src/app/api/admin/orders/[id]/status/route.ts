import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import type { HydratedDocument } from 'mongoose';
import { Order, type IOrder } from '@/models/order.model';
import { restoreStock, clearSoldOutWhereInStock, settleOrderStock, inTransaction } from '@/lib/stock-reservation';
import { revalidateCatalog } from '@/lib/revalidate-storefront';

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
  // The status change and the restocking are ONE transaction (a crash can neither lose nor repeat
  // the restock), and the status filter makes a double click change it only once.
  const NOT_SETTLED = new Error('stock not settled yet');
  let previous: HydratedDocument<IOrder> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    // A paid order whose stock was never settled (a crash, not yet repaired) is settled first, so
    // cancelling gives back exactly what was taken
    if (status === 'CANCELLED') {
      const pending = await Order.findOne({ _id: id, stockSettled: false }).select('_id').lean();
      if (pending) await settleOrderStock(pending._id);
    }
    try {
      previous = await inTransaction(async (session) => {
        const before = await Order.findOneAndUpdate(
          { _id: id, status: { $ne: 'CANCELLED' } },
          { status },
          { returnDocument: 'before', session },
        );
        if (!before) return null;
        if (status === 'CANCELLED' && before.paymentStatus === 'PAID') {
          if (before.stockSettled === false) throw NOT_SETTLED; // settled by someone else in between: start again
          // Only what was really taken from stock goes back. Orders from before deductedQuantity
          // existed have no record, so they give back the full quantity (as they always did).
          await restoreStock(
            before.items.map((i) => ({ productId: i.productId, size: i.selectedSize, quantity: i.deductedQuantity ?? i.quantity })),
            session,
          );
        }
        return before;
      });
      break;
    } catch (error) {
      if (error !== NOT_SETTLED || attempt === 2) throw error;
    }
  }

  if (!previous) {
    const exists = await Order.exists({ _id: id });
    if (!exists) return errorResponse('Order not found', 404);
    return errorResponse('A cancelled order cannot be changed', 409);
  }

  if (status === 'CANCELLED' && previous.paymentStatus === 'PAID') {
    // Stock is back, so the automatic "Sold Out" label no longer applies
    await clearSoldOutWhereInStock(previous.items.map((i) => i.productId));
    revalidateCatalog();
  }

  const order = await Order.findById(id);
  return successResponse({ order, message: 'Status updated successfully' });
});

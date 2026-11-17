import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { withAdmin, parseJsonBody, errorResponse, successResponse, validationError } from '@/lib/api-helpers';
import { Order } from '@/models/order.model';
import { OrderRefundSchema } from '@/schemas/admin';
import { queueOrderEmail } from '@/lib/email/order-mail';

export const maxDuration = 60; // the refund e-mail goes out after the response

/**
 * Records a refund by hand: nothing is sent to Razorpay (refunds are made in its dashboard).
 * The admin sets the status (not needed / pending / refunded), an optional note and the Razorpay
 * refund id. Only the validated fields are saved; an empty note or id clears it.
 */
export const PATCH = withAdmin(async (req: NextRequest, context) => {
  const { id } = await context.params;
  if (!id || !mongoose.isValidObjectId(id)) return errorResponse('Invalid order ID', 400);

  const body = await parseJsonBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse('Request body must be an object', 400);
  const parsed = OrderRefundSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { refundStatus, refundNote, razorpayRefundId } = parsed.data;

  const set: Record<string, unknown> = { refundStatus };
  const unset: Record<string, 1> = {};
  for (const [key, value] of [['refundNote', refundNote], ['razorpayRefundId', razorpayRefundId]] as const) {
    if (value) set[key] = value;
    else if (value !== undefined) unset[key] = 1; // sent empty: clear it
  }

  // The document BEFORE the change tells whether this save is the one that makes it REFUNDED
  const before = await Order.findOneAndUpdate(
    { _id: id, paymentStatus: 'PAID' },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: 'before', runValidators: true },
  ).select('refundStatus');
  if (!before) return errorResponse('Order not found', 404);
  const order = await Order.findById(id).select('-razorpaySignature');
  if (!order) return errorResponse('Order not found', 404);

  // Saved: tell the customer once, when the refund BECOMES completed (saving it again sends nothing)
  if (refundStatus === 'REFUNDED' && before.refundStatus !== 'REFUNDED') await queueOrderEmail('order-refunded', id);

  return successResponse({ order, message: 'Refund details saved' });
});

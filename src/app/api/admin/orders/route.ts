import { NextRequest } from 'next/server';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import mongoose from 'mongoose';
import { Order } from '@/models/order.model';
import { Product } from '@/models/product.model';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { EmailLog } from '@/models/email-log.model';
import { isResendable } from '@/lib/email';
import { ORDER_EMAIL_TYPES, type EmailType } from '@/lib/email/types';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const pagination = parsePagination(searchParams);

    const base = { paymentStatus: 'PAID' };
    const query: Record<string, unknown> = { ...base };
    // A link from an owner e-mail: just that one order, whatever tab it would be on
    const only = searchParams.get('order');
    if (only && mongoose.isValidObjectId(only)) {
      query._id = only;
    } else if (status === 'REFUND_PENDING') {
      query.refundStatus = 'PENDING'; // the "Refund pending" tab (a filter, not an order status)
    } else if (status && status !== 'ALL') {
      query.status = status;
    }

    const [orders, total, grouped, refundPending] = await Promise.all([
      Order.find(query)
        .select('-razorpaySignature') // never needed by the page
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Order.countDocuments(query),
      // Count per status for the tabs, independent of the selected tab
      Order.aggregate<{ _id: string; count: number }>([
        { $match: base },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ paymentStatus: 'PAID', refundStatus: 'PENDING' }),
    ]);
    const statusCounts: Record<string, number> = { ALL: 0, REFUND_PENDING: refundPending };
    for (const g of grouped) {
      statusCounts[g._id] = g.count;
      statusCounts.ALL += g.count;
    }

    // One lookup of the products on these orders, for two things:
    //  - orders placed before the colour was recorded show the product's current colour;
    //  - every line gets the product's CURRENT photo (currentImage), shown when the photo the
    //    order was placed with has since been deleted.
    const productIds = [...new Set(orders.flatMap((o) => o.items.filter((i) => i.productId).map((i) => String(i.productId))))];
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select('colorName colorHex images')
        .lean();
      const byId = new Map(products.map((p) => [String(p._id), p]));
      for (const order of orders) {
        for (const item of order.items as (typeof order.items[number] & { currentImage?: string })[]) {
          const p = item.productId ? byId.get(String(item.productId)) : undefined;
          if (!p) continue;
          item.currentImage = p.images?.[0]?.url || undefined;
          if (!item.selectedColor && p.colorName) {
            item.selectedColor = p.colorName;
            item.selectedColorHex = p.colorHex || undefined;
          }
        }
      }
    }

    // Orders that share a Razorpay payment id with ANOTHER order (the same payment recorded twice):
    // one lookup for the page, shown in the "Needs review" note (src/lib/duplicate-note.ts).
    const paymentIds = [...new Set(orders.map((o) => o.razorpayPaymentId).filter((id): id is string => !!id))];
    const samePaymentAs = new Map<string, string[]>();
    if (paymentIds.length) {
      const sharing = await Order.find({ razorpayPaymentId: { $in: paymentIds } }).select('razorpayPaymentId').lean();
      const byPayment = new Map<string, string[]>();
      for (const o of sharing) byPayment.set(o.razorpayPaymentId!, [...(byPayment.get(o.razorpayPaymentId!) ?? []), String(o._id)]);
      for (const order of orders) {
        const ids = order.razorpayPaymentId ? byPayment.get(order.razorpayPaymentId) : undefined;
        if (ids && ids.length > 1) samePaymentAs.set(String(order._id), ids.filter((id) => id !== String(order._id)));
      }
    }
    // The customer e-mails of these orders and what became of each (one lookup by the unique key, no extra index)
    const keys = orders.flatMap((o) => ORDER_EMAIL_TYPES.map((t) => `${t}:${String(o._id)}`));
    const logs = keys.length ? await EmailLog.find({ dedupeKey: { $in: keys } }).sort({ createdAt: 1 }).lean() : [];
    const emailsByOrder = new Map<string, unknown[]>();
    for (const l of logs) {
      emailsByOrder.set(l.relatedId, [...(emailsByOrder.get(l.relatedId) ?? []), {
        id: String(l._id), type: l.type, status: l.status, attempts: l.attempts, permanent: l.permanent,
        lastErrorCode: l.lastErrorCode ?? null, createdAt: l.createdAt.toISOString(), sentAt: l.sentAt ? l.sentAt.toISOString() : null,
        canResend: l.status === 'failed' && isResendable(l.type as EmailType),
      }]);
    }
    const withDuplicates = orders.map((o) => ({ ...o, emails: emailsByOrder.get(String(o._id)) ?? [], ...(samePaymentAs.has(String(o._id)) ? { samePaymentAs: samePaymentAs.get(String(o._id)) } : {}) }));

    return successResponse({ orders: withDuplicates, statusCounts, ...paginationMeta(total, pagination) });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return errorResponse('Failed to fetch orders', 500);
  }
});

import { NextRequest } from 'next/server';
import { withAdmin, errorResponse, successResponse } from '@/lib/api-helpers';
import { Order } from '@/models/order.model';
import { Product } from '@/models/product.model';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query: Record<string, unknown> = { paymentStatus: 'PAID' };
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    // Orders placed before the colour was recorded: show the product's current colour instead
    const missing = [
      ...new Set(
        orders.flatMap((o) => o.items.filter((i) => !i.selectedColor && i.productId).map((i) => String(i.productId))),
      ),
    ];
    if (missing.length) {
      const products = await Product.find({ _id: { $in: missing }, colorName: { $ne: '' } })
        .select('colorName colorHex')
        .lean();
      const colorOf = new Map(products.map((p) => [String(p._id), p]));
      for (const order of orders) {
        for (const item of order.items) {
          const p = !item.selectedColor && item.productId ? colorOf.get(String(item.productId)) : undefined;
          if (p) {
            item.selectedColor = p.colorName;
            item.selectedColorHex = p.colorHex || undefined;
          }
        }
      }
    }

    return successResponse({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return errorResponse('Failed to fetch orders', 500);
  }
});

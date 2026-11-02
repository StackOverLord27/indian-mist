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

    return successResponse({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return errorResponse('Failed to fetch orders', 500);
  }
});

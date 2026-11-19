/**
 * The one calculation of what an order costs, used by the cart, the checkout page and the
 * create-order route, so the threshold comparison and the rounding cannot differ between them.
 * No constants live here: the rules always come from the caller (the owner's pricing settings,
 * or the server's last-resort values; see shipping-rules.ts).
 */
export interface ShippingRules {
  /** Flat fee in INR when the subtotal is below the threshold */
  shippingCost: number;
  /** Subtotal (INR) at or above which shipping is free */
  freeShippingThreshold: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shippingFree: boolean;
  shippingCost: number;
  /** GST is switched off (no registration yet) */
  taxAmount: number;
  /** Whole paise: what Razorpay is asked to charge */
  totalPaise: number;
  /** totalPaise / 100: what every screen shows and what is stored on the order */
  total: number;
}

export function computeOrderTotals(input: { subtotal: number; discount?: number; rules: ShippingRules }): OrderTotals {
  const { subtotal, rules } = input;
  const discount = input.discount ?? 0;
  const discountedSubtotal = Math.max(subtotal - discount, 0);
  // The threshold is compared with the subtotal BEFORE any promo discount
  const shippingFree = subtotal >= rules.freeShippingThreshold;
  const shippingCost = shippingFree ? 0 : rules.shippingCost;
  const taxAmount = 0;
  const totalPaise = Math.round((discountedSubtotal + shippingCost + taxAmount) * 100);
  return { subtotal, discount, discountedSubtotal, shippingFree, shippingCost, taxAmount, totalPaise, total: totalPaise / 100 };
}

/** How much more to add for free shipping, and how far along the bar is (0 to 100). */
export function freeShippingProgress(subtotal: number, rules: ShippingRules) {
  const threshold = rules.freeShippingThreshold;
  return {
    remaining: Math.max(threshold - subtotal, 0),
    percent: threshold > 0 ? Math.min((subtotal / threshold) * 100, 100) : 100,
  };
}

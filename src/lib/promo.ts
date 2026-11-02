import { Order } from "@/models/order.model";

/**
 * Promo codes are compared upper-cased and trimmed EVERYWHERE (apply route, create-order,
 * finalizeOrder, admin settings), and orders store the upper-cased code. Keep that rule here.
 */
export const normalizePromoCode = (code: string): string => code.trim().toUpperCase();

export function findPromo<T extends { code: string }>(promos: T[] | undefined, code: string): T | undefined {
  const wanted = normalizePromoCode(code);
  return (promos ?? []).find((p) => normalizePromoCode(p.code) === wanted);
}

/**
 * How many times a code has been used. Only PAID orders count: an abandoned checkout, a failed
 * payment or a pending order never uses up a code.
 */
export function countPaidPromoUses(code: string, opts: { userId?: string; excludeOrderId?: unknown } = {}): Promise<number> {
  const filter: Record<string, unknown> = { promoCode: normalizePromoCode(code), paymentStatus: "PAID" };
  if (opts.userId) filter.userId = opts.userId;
  if (opts.excludeOrderId !== undefined) filter._id = { $ne: opts.excludeOrderId };
  return Order.countDocuments(filter);
}

/** Percentage or fixed discount for a subtotal, whole rupees for percentages, never above the subtotal. */
export function promoDiscount(promo: { discountType: string; discountValue: number }, subtotal: number): number {
  let discount: number;
  if (promo.discountType === "PERCENTAGE") {
    const pct = Math.min(Math.max(Number(promo.discountValue) || 0, 0), 100);
    discount = Math.floor(subtotal * (pct / 100));
  } else {
    discount = Number(promo.discountValue) || 0;
  }
  return Math.min(Math.max(discount, 0), subtotal);
}

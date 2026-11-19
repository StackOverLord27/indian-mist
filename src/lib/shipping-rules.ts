import { SHIPPING_COST, SHIPPING_THRESHOLD } from "@/lib/constants";
import type { ShippingRules } from "@/lib/order-totals";

/**
 * SERVER ONLY. The shipping rules the server charges: the owner's pricing settings, and the
 * compile-time constants only as the last resort when nothing is saved. Browser code must never
 * import this file (it would put the constants in the bundle); the browser gets the result from
 * GET /api/settings (`shippingRules`), so what it shows is exactly what the server will charge.
 */
export function resolveShippingRules(
  pricing: { shippingCost?: number | null; freeShippingThreshold?: number | null } | null | undefined,
): ShippingRules {
  return {
    shippingCost: pricing?.shippingCost ?? SHIPPING_COST,
    freeShippingThreshold: pricing?.freeShippingThreshold ?? SHIPPING_THRESHOLD,
  };
}

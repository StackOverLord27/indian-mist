import { STATIC_BUILDERS as CUSTOMER } from "./order-data";
import { buildFailedSummary, buildLowStock, buildOwnerNewOrder, buildPaymentAlert } from "./owner-data";

type AnyBuilder = (relatedId: string) => Promise<{ to: string; data: never } | null>;

/** How to rebuild each e-mail that can be retried or resent, by type (see getBuilder in index.ts). */
export const STATIC_BUILDERS: Partial<Record<string, AnyBuilder>> = {
  ...CUSTOMER,
  "owner-new-order": buildOwnerNewOrder as unknown as AnyBuilder,
  "owner-payment-alert": buildPaymentAlert as unknown as AnyBuilder,
  "owner-failed-summary": buildFailedSummary as unknown as AnyBuilder,
  "owner-low-stock": buildLowStock as unknown as AnyBuilder,
};

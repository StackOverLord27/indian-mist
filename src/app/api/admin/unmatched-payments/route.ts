export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { withAdmin, successResponse } from "@/lib/api-helpers";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";

/** Payments Razorpay confirmed for which no order could be created and nobody has resolved yet. */
export const GET = withAdmin(async () => {
  const unresolved = { resolvedAt: { $exists: false } };
  const [count, payments] = await Promise.all([
    UnmatchedPayment.countDocuments(unresolved),
    UnmatchedPayment.find(unresolved).sort({ createdAt: -1 }).limit(50).select("-__v").lean(),
  ]);
  return successResponse({ count, payments });
});

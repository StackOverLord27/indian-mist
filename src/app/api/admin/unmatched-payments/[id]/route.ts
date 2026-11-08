export const runtime = "nodejs";

import mongoose from "mongoose";
import { withAdmin, successResponse, errorResponse } from "@/lib/api-helpers";
import { UnmatchedPayment } from "@/models/unmatched-payment.model";

/**
 * Marks an unmatched payment resolved by hand: the admin has refunded it in Razorpay or fulfilled
 * it outside the site, so it should leave the dashboard list. Nothing is sent to Razorpay.
 * Safe to repeat. A later retry of the same payment (webhook) does not bring it back: the record
 * is kept and keeps its resolved state.
 */
export const PATCH = withAdmin(async (_req, context) => {
  const { id } = await context.params;
  if (!id || !mongoose.isValidObjectId(id)) return errorResponse("Invalid payment ID", 400);

  const resolved = await UnmatchedPayment.findOneAndUpdate(
    { _id: id, resolvedAt: { $exists: false } },
    { resolvedAt: new Date(), resolvedManually: true },
    { returnDocument: "after" },
  ).lean();
  if (resolved) return successResponse({ resolved: true, message: "Marked as resolved" });

  // Already resolved (a second click, or an order appeared meanwhile) is fine; an unknown id is not
  if (await UnmatchedPayment.exists({ _id: id })) return successResponse({ resolved: true, message: "Already resolved" });
  return errorResponse("Payment not found", 404);
});

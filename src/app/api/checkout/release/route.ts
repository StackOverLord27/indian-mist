export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { releaseReservation } from "@/lib/stock-reservation";

// Called when a shopper closes the payment window without paying, so the held stock goes back on sale.
export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  let razorpayOrderId: unknown;
  try {
    ({ razorpayOrderId } = await req.json());
  } catch {
    return errorResponse("Invalid request", 400);
  }
  if (typeof razorpayOrderId !== "string" || !razorpayOrderId || razorpayOrderId.length > 64) {
    return errorResponse("Invalid order", 400);
  }

  // Only the shopper who started this checkout can release its stock
  const released = await releaseReservation({ razorpayOrderId, userId });
  return successResponse({ released });
});

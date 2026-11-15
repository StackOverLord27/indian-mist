import { NextRequest } from "next/server";
import { withDB, successResponse, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user.model";
import { Order } from "@/models/order.model";
// The product model must be registered for the order lookup below (populate). Without this import a
// server instance that had not loaded it yet answered 500 for every customer who had orders.
import { Product } from "@/models/product.model";
import { ProfileUpdateSchema } from "@/schemas/checkout-api";

export const GET = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return errorResponse("Unauthenticated", 401);
  }

  // The checkout only needs the saved details to pre-fill the form: `?orders=0` skips the order
  // history (up to 50 orders and a lookup of their products), which is by far the heavy part.
  const wantOrders = new URL(req.url).searchParams.get("orders") !== "0";

  // The two reads do not depend on each other: run them together (one round trip instead of two)
  const [user, orders] = await Promise.all([
    User.findById(userId).select("-password").lean(),
    wantOrders
      ? Order.find({ userId, paymentStatus: "PAID" })
          .sort({ createdAt: -1 })
          .limit(50) // the latest 50 orders: this list is not paged
          // payment internals and the shop's own notes (review notes, refund notes and ids) are never sent to the customer
          .select("-razorpaySignature -razorpayPaymentId -reviewNote -refundNote -razorpayRefundId -stockSettled -finalizedVia -finalizedAt")
          // only the name, slug, price and FIRST photo of each product are shown; a product can carry many photos
          .populate({ path: "items.productId", model: Product, select: { name: 1, price: 1, slug: 1, images: { $slice: 1 } } })
          .lean()
      : Promise.resolve([]),
  ]);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  // Personal data: never cached by the browser or any shared cache, so a status change the shop
  // makes shows on the very next load
  return Response.json({ user, orders }, { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return errorResponse("Unauthenticated", 401);
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse("Invalid request", 400);
    }

    const parsed = ProfileUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request", 400);
    }
    const { shippingAddress, phone, name } = parsed.data;

    const updateFields: Record<string, unknown> = {};
    if (shippingAddress !== undefined) {
      updateFields.shippingAddress = { ...shippingAddress, country: shippingAddress.country || "India" };
    }
    if (phone !== undefined) updateFields.phone = phone;
    if (name !== undefined) updateFields.name = name;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password").lean();

    if (!updatedUser) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ user: updatedUser });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return errorResponse("Failed to update profile", 500);
  }
});

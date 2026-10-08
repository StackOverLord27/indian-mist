import { NextRequest } from "next/server";
import { withDB, successResponse, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user.model";
import { Order } from "@/models/order.model";
import { ProfileUpdateSchema } from "@/schemas/checkout-api";

export const GET = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return errorResponse("Unauthenticated", 401);
  }

  const user = await User.findById(userId).select("-password").lean();
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const orders = await Order.find({ userId, paymentStatus: "PAID" })
    .sort({ createdAt: -1 })
    .populate("items.productId", "name images price slug")
    .lean();

  return successResponse({ user, orders });
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

import { NextRequest } from "next/server";
import { withDB, successResponse, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user.model";
import { Order } from "@/models/order.model";

export const GET = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return errorResponse("Unauthenticated", 401);
  }

  const user = await User.findById(userId).select("-password").lean();
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const orders = await Order.find({ userId })
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
    const body = await req.json();
    const { shippingAddress, phone, name } = body;

    const updateFields: any = {};
    if (shippingAddress !== undefined) updateFields.shippingAddress = shippingAddress;
    if (phone !== undefined) updateFields.phone = phone;
    if (name !== undefined) updateFields.name = name;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select("-password").lean();

    if (!updatedUser) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ user: updatedUser });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update profile", 500);
  }
});

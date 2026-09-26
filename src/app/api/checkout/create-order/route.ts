export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import { Order } from "@/models/order.model";
import { User } from "@/models/user.model";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const POST = withDB(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return errorResponse("Unauthenticated", 401);

  const body = await req.json();
  const {
    items,
    subtotal,
    shippingCost,
    taxAmount,
    totalAmount,
    customerName,
    email,
    phone,
    shippingAddress,
    saveAddress,
  } = body;

  if (!items?.length) return errorResponse("Cart is empty", 400);
  if (!customerName || !email || !phone)
    return errorResponse("Customer details are required", 400);
  if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.zipCode)
    return errorResponse("Complete shipping address is required", 400);

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100), // Razorpay expects amount in paise
    currency: "INR",
    receipt: `order_${Date.now()}`,
    notes: {
      customerName,
      email,
    },
  });

  // Create order in DB with PENDING status
  const order = await Order.create({
    userId,
    items: items.map((item: any) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      priceAtPurchase: item.price,
      image: typeof item.image === 'string' ? item.image : item.image?.url || '',
      selectedSize: item.size,
      selectedColor: item.color,
    })),
    status: "PENDING",
    totalAmount,
    subtotal,
    shippingCost,
    taxAmount,
    paymentStatus: "UNPAID",
    razorpayOrderId: razorpayOrder.id,
    customerName,
    email,
    phone,
    shippingAddress: {
      ...shippingAddress,
      country: shippingAddress.country || "India",
    },
  });

  // If the user checked "Save this address", update their profile
  if (saveAddress) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        shippingAddress: {
          ...shippingAddress,
          country: shippingAddress.country || "India",
        },
        // Only update name and phone if they are missing or if you want to override them
        // Let's assume we update them if provided
        name: customerName,
        phone: phone,
      },
    });
  }

  return successResponse({
    orderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
  });
});

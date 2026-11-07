import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  priceAtPurchase: number;
  image?: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedColorHex?: string;
  /**
   * Units actually taken from stock when this order was settled. Cancelling gives back exactly
   * this many. Absent on orders created before it existed (those give back the full quantity).
   */
  deductedQuantity?: number;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount?: number;
  promoCode?: string;
  deliveryNotes?: string;
  reviewNote?: string;
  /**
   * false = paid, stock not settled yet (a repair pass finishes it); true = settled.
   * Absent on orders created before it existed: those are treated as settled.
   */
  stockSettled?: boolean;
  paymentStatus: "UNPAID" | "PAID" | "FAILED";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  priceAtPurchase: { type: Number, required: true },
  image: { type: String },
  selectedSize: { type: String },
  selectedColor: { type: String },
  selectedColorHex: { type: String },
  deductedQuantity: { type: Number, min: 0 },
});

const OrderSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [OrderItemSchema], // Embedded array
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    totalAmount: { type: Number, required: true },
    subtotal: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    promoCode: { type: String },
    deliveryNotes: { type: String },
    reviewNote: { type: String },
    stockSettled: { type: Boolean },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID", "FAILED"],
      default: "UNPAID",
    },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// Add compound index to make promo code validation instantaneous
OrderSchema.index({ userId: 1, promoCode: 1 });
// Total uses of a promo code (only PAID orders count): promo route, create-order, finalizeOrder
OrderSchema.index({ promoCode: 1, paymentStatus: 1 });
// Admin orders list: the PAID orders of one status tab, newest first, and the per-tab counts
OrderSchema.index({ paymentStatus: 1, status: 1, createdAt: -1 });
// ...and the "All orders" tab (PAID, newest first)
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
// Repair pass: paid orders whose stock was never settled (a handful at most; sparse keeps it tiny)
OrderSchema.index({ stockSettled: 1, createdAt: 1 }, { partialFilterExpression: { stockSettled: false } });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Order;
}

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);


import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * A payment Razorpay confirmed for which no order could be created (the checkout session was
 * gone). The shop must look at each one: fulfil by hand or refund in Razorpay. Saved so this
 * never depends on reading logs. Resolved automatically if an order for it appears later.
 */
export interface IUnmatchedPayment extends Document {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Amount in rupees when the source carried it (the webhook does; the browser confirmation does not). */
  amount?: number;
  source: "webhook" | "verify-payment";
  /** How many times this payment was seen (Razorpay retries, the shopper reloads) */
  seen: number;
  resolvedAt?: Date;
  resolvedOrderId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UnmatchedPaymentSchema = new Schema<IUnmatchedPayment>(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, required: true },
    amount: { type: Number },
    source: { type: String, enum: ["webhook", "verify-payment"], required: true },
    seen: { type: Number, default: 1 },
    resolvedAt: { type: Date },
    resolvedOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

// Dashboard: the unresolved ones, newest first
UnmatchedPaymentSchema.index({ resolvedAt: 1, createdAt: -1 });

export const UnmatchedPayment: Model<IUnmatchedPayment> =
  mongoose.models.UnmatchedPayment ||
  mongoose.model<IUnmatchedPayment>("UnmatchedPayment", UnmatchedPaymentSchema);

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStockReservation extends Document {
  razorpayOrderId?: string;
  userId: mongoose.Types.ObjectId;
  items: { productId: mongoose.Types.ObjectId; size?: string; quantity: number }[];
  status: "ACTIVE" | "CONSUMED" | "RELEASED";
  expiresAt: Date;
}

const StockReservationSchema = new Schema<IStockReservation>(
  {
    razorpayOrderId: { type: String, unique: true, sparse: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        size: { type: String },
        quantity: { type: Number, required: true },
      },
    ],
    status: { type: String, enum: ["ACTIVE", "CONSUMED", "RELEASED"], default: "ACTIVE" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

StockReservationSchema.index({ status: 1, expiresAt: 1 });
StockReservationSchema.index({ userId: 1, status: 1 });

export const StockReservation: Model<IStockReservation> =
  mongoose.models.StockReservation ||
  mongoose.model<IStockReservation>("StockReservation", StockReservationSchema);

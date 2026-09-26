import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: "ADMIN" | "CUSTOMER";
  isVerified: boolean;
  createdAt: Date;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String }, // Optional in case of OAuth
  role: { type: String, enum: ["ADMIN", "CUSTOMER"], default: "CUSTOMER" },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  shippingAddress: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
  },
});

// Pre-save hook to hash password before saving to DB
UserSchema.pre("save", async function () {
  const user = this as unknown as IUser;

  // Only hash the password if it has been modified (or is new)
  if (!user.isModified("password") || !user.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(user.password, salt);
  user.password = hash;
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const user = this as unknown as IUser;
  if (!user.password) return false;
  return bcrypt.compare(candidatePassword, user.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

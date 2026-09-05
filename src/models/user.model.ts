import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "CUSTOMER";
  isVerified: boolean;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional in case of OAuth
  role: { type: String, enum: ["ADMIN", "CUSTOMER"], default: "CUSTOMER" },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
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

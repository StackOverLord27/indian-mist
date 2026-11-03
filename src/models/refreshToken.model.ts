import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string; // SHA-256 hex of the raw refresh token — never store raw
  family: string;    // UUID shared across all rotations of one login session
  expiresAt: Date;
  /** Set (atomically) the moment this token is exchanged for a new one; the token stays so a replay can be told apart from a parallel request */
  usedAt?: Date;
}

const RefreshTokenSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  family: {
    type: String,
    required: true,
    index: true,
  },
  usedAt: { type: Date },
  // Explicit Date field used by MongoDB TTL so that expired tokens are
  // automatically reaped by the DB without any application-level cleanup.
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL: delete when expiresAt < now
  },
});

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);

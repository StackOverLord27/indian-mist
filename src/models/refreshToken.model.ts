import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string; // SHA-256 hex of the raw refresh token — never store raw
  family: string;    // UUID of one login session (shared by its rows)
  expiresAt: Date;
  /** Legacy: set by the old rotating design when a token was exchanged. Ignored now (kept so old rows still load). */
  usedAt?: Date;
  /** The session's hard end. Absent on rows created before tokens stopped rotating ("legacy": upgraded on first use). */
  absoluteExpiresAt?: Date;
  /** Last successful renewal (diagnostics only) */
  lastUsedAt?: Date;
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
  absoluteExpiresAt: { type: Date },
  lastUsedAt: { type: Date },
  // Explicit Date field used by MongoDB TTL so that expired tokens are
  // automatically reaped by the DB without any application-level cleanup.
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL: delete when expiresAt < now
  },
});

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.RefreshToken;
}

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);

import mongoose from "mongoose";

export type EmailStatus = "queued" | "sent" | "failed";

export interface IEmailLog {
  type: string;
  /** One row per (type, related id): the unique index is what makes a send happen at most once. */
  dedupeKey: string;
  /** Only kept for types that can be resent (a resend needs it). Never for sign-in codes. */
  recipient?: string;
  relatedId: string;
  status: EmailStatus;
  attempts: number;
  /** A permanent failure (5xx, bad address, bad setup) is never retried; a retryable one waits for nextAttemptAt. */
  permanent: boolean;
  /** SMTP reply code or error code only. Never a message body, a recipient or a secret. */
  lastErrorCode?: string;
  nextAttemptAt?: Date;
  sentAt?: Date;
  /** The day (shop time, YYYY-MM-DD) of the failed-e-mail summary that reported this permanent failure */
  summaryDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EMAIL_LOG_TTL_SECONDS = 90 * 24 * 60 * 60;

const EmailLogSchema = new mongoose.Schema<IEmailLog>(
  {
    type: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    recipient: { type: String },
    relatedId: { type: String, required: true },
    status: { type: String, enum: ["queued", "sent", "failed"], required: true, default: "queued" },
    attempts: { type: Number, default: 0 },
    permanent: { type: Boolean, default: false },
    lastErrorCode: { type: String },
    nextAttemptAt: { type: Date },
    sentAt: { type: Date },
    summaryDate: { type: String },
  },
  { timestamps: true },
);

EmailLogSchema.index({ dedupeKey: 1 }, { unique: true });
EmailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: EMAIL_LOG_TTL_SECONDS });
EmailLogSchema.index({ status: 1, nextAttemptAt: 1 });

// Rebuild the model on dev reloads so schema changes are not silently dropped (see the other models).
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.EmailLog;
}

export const EmailLog = mongoose.models.EmailLog || mongoose.model<IEmailLog>("EmailLog", EmailLogSchema);

import type { ClientSession, Types } from "mongoose";
import { Order } from "@/models/order.model";

/**
 * Adds a line to the note the shop sees on an order, keeping what is already there. The same
 * note is never added twice (a webhook retry, a repeated check), and the append is one atomic
 * database step, so two writers cannot overwrite each other.
 */
export async function addReviewNote(orderId: Types.ObjectId | string, note: string, session?: ClientSession) {
  const escaped = note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await Order.updateOne(
    { _id: orderId, reviewNote: { $not: new RegExp(escaped) } },
    [
      {
        $set: {
          reviewNote: { $trim: { input: { $concat: [{ $ifNull: ["$reviewNote", ""] }, " ", { $literal: note }] } } },
        },
      },
    ],
    { session, updatePipeline: true },
  );
}

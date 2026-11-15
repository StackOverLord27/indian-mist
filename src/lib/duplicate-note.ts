/**
 * Wording of the admin's "Needs review" note about orders that look like duplicates. Plain
 * functions, no database, so the server (when the note is saved) and the admin page (when it is
 * shown) use the same text.
 */
import { orderNumber } from "@/lib/order-number";

/** Another order carries the SAME Razorpay payment id: the money was taken once, the order exists twice. */
export function samePaymentText(otherOrderIds: unknown[]): string {
  const others = otherOrderIds.map((id) => orderNumber(id)).join(", ");
  return `The same payment was recorded twice: order ${others} has the same Razorpay payment id. The customer paid once. Ship only ONE of the orders and cancel the other (no refund is needed for it).`;
}

/** Two different payments, same account, same items, close together. */
export const POSSIBLE_DUPLICATE_RE = /Possible duplicate payment: [^]*?refund one in Razorpay if it is a mistake\.\s*/g;

/**
 * The note as the admin sees it. When another order has the same payment id, the "possible
 * duplicate purchase" sentence is replaced by the plain "recorded twice" message (a second order
 * for the same payment is not a second purchase).
 */
export function reviewNoteForDisplay(note: string | undefined, samePaymentAs: unknown[] | undefined): string {
  const text = (note ?? "").trim();
  if (!samePaymentAs?.length) return text;
  const rest = text.replace(POSSIBLE_DUPLICATE_RE, "").replace(/The same payment was recorded twice:[^]*?cancel the other \(no refund is needed for it\)\.\s*/g, "").trim();
  return [samePaymentText(samePaymentAs), rest].filter(Boolean).join(" ");
}

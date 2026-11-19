/** The e-mails the shop sends. Add a type here, then a template in templates.ts. */
export type EmailType =
  | "otp-signup"
  | "otp-reset"
  | "contact"
  | "order-confirmation"
  | "order-shipped"
  | "order-cancelled"
  | "order-refunded"
  | "order-delivered"
  | "password-changed"
  | "owner-new-order"
  | "owner-payment-alert"
  | "owner-failed-summary"
  | "owner-low-stock";

/** The e-mails to the shop owner (address from the admin contact settings, else SUPER_ADMIN_EMAIL). */
export const OWNER_EMAIL_TYPES = ["owner-new-order", "owner-payment-alert", "owner-failed-summary", "owner-low-stock"] as const satisfies readonly EmailType[];
export type OwnerEmailType = (typeof OWNER_EMAIL_TYPES)[number];

/** Payment problems the owner is warned about, each with its own "what to do next". */
export type PaymentAlertKind = "payment-without-order" | "duplicate-payment" | "refund-due" | "order-in-review";
export const PAYMENT_ALERT_KINDS: readonly PaymentAlertKind[] = ["payment-without-order", "duplicate-payment", "refund-due", "order-in-review"];

export type PaymentAlertData = {
  kind: PaymentAlertKind;
  razorpayOrderId?: string;
  razorpayPaymentId: string;
  /** Rupees, when known */
  amount?: number;
  /** The shop's order (absent for a payment that has no order) */
  orderId?: string;
  /** The order's "needs review" note, as the admin sees it */
  note?: string;
};

export type FailedSummaryData = { date: string; total: number; byType: { type: string; count: number }[] };
export type LowStockData = { productId: string; name: string; left: number; threshold: number };

/** The order e-mail types: each is sent at most once per order (the order id is the related id). */
export const ORDER_EMAIL_TYPES = ["order-confirmation", "order-shipped", "order-cancelled", "order-refunded", "order-delivered"] as const satisfies readonly EmailType[];
export type OrderEmailType = (typeof ORDER_EMAIL_TYPES)[number];

/** How to reach the shop, from the admin contact settings. Every part is optional. */
export type ShopInfo = {
  email?: string; phone?: string; hours?: string;
  /** Optional policy pages that exist (saved, non-empty text): only these are linked in the footer */
  policies?: ("refund-policy" | "shipping-policy")[];
};

/**
 * An order as an e-mail needs it: plain values, assembled by `buildOrderMail` from the order as it
 * is NOW (a retried e-mail says what is true at the time it is sent). Money is in rupees.
 */
export type OrderMailData = {
  orderId: string;
  customerName: string;
  placedAt: string; // ISO instant
  lines: { name: string; quantity: number; price: number; size?: string; color?: string }[];
  subtotal: number;
  shipping: number;
  discount: number;
  promoCode?: string;
  tax: number;
  total: number;
  address: { street: string; city: string; state: string; zipCode: string; country: string };
  /** The order's status and refund state when the e-mail was built (the wording depends on them) */
  orderStatus: string;
  paymentStatus: string;
  refundStatus?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shop: ShopInfo;
};

export type EmailData = {
  "otp-signup": { otp: string };
  "otp-reset": { otp: string };
  contact: { name: string; email: string; phone?: string; topic: string; message: string };
  "order-confirmation": OrderMailData;
  "order-shipped": OrderMailData;
  "order-cancelled": OrderMailData;
  "order-refunded": OrderMailData;
  "order-delivered": OrderMailData;
  "password-changed": { name: string; changedAt: string; shop: ShopInfo };
  "owner-new-order": OrderMailData;
  "owner-payment-alert": PaymentAlertData;
  "owner-failed-summary": FailedSummaryData;
  "owner-low-stock": LowStockData;
};

export type MailMessage = {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  messageId?: string;
};

export type MailError = {
  /** retryable: 4xx replies and network trouble. permanent: 5xx replies, bad address, bad setup. */
  kind: "retryable" | "permanent";
  /** An SMTP reply code (as text) or an error code. Never a message, recipient or secret. */
  code: string;
};

export type SendOutcome = { ok: true; id: string } | { ok: false; error: MailError };

/** Everything the rest of the code needs from a mail provider. Swap the provider by swapping this. */
export interface MailTransport {
  send(message: MailMessage): Promise<SendOutcome>;
}

export type SendMailResult =
  | { status: "sent" }
  | { status: "duplicate" } // the same (type, related id) was already claimed: nothing sent
  | { status: "dropped"; reason: "disabled" | "not-allowlisted" } // guard: nothing sent, on purpose
  | { status: "capped"; reason: "hourly" | "daily-near-limit" } // owner alert held back by the volume cap (logged)
  | { status: "failed"; retryable: boolean; code: string };

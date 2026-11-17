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
  | "password-changed";

/** The order e-mail types: each is sent at most once per order (the order id is the related id). */
export const ORDER_EMAIL_TYPES = ["order-confirmation", "order-shipped", "order-cancelled", "order-refunded", "order-delivered"] as const satisfies readonly EmailType[];
export type OrderEmailType = (typeof ORDER_EMAIL_TYPES)[number];

/** How to reach the shop, from the admin contact settings. Every part is optional. */
export type ShopInfo = { email?: string; phone?: string; hours?: string };

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
  | { status: "failed"; retryable: boolean; code: string };

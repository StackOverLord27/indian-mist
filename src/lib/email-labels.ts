/** What the admin sees for each kind of e-mail (client-safe: no server imports). */
export const EMAIL_TYPE_LABEL: Record<string, string> = {
  "otp-signup": "Sign-up code",
  "otp-reset": "Password reset code",
  contact: "Contact message",
  "order-confirmation": "Order confirmation",
  "order-shipped": "Shipped",
  "order-cancelled": "Cancelled",
  "order-refunded": "Refund completed",
  "order-delivered": "Delivered",
  "password-changed": "Password changed",
};
export const emailTypeLabel = (type: string) => EMAIL_TYPE_LABEL[type] ?? type;

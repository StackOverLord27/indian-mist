/**
 * How long stock is held for a checkout, and how long the Razorpay payment window may stay open.
 * One place for both numbers, importable by the server (stock holds) and the browser (the
 * Checkout window), so the window can never outlive the hold.
 */

// How long stock is held for a checkout before it is returned to sale.
// Deliberately SHORT and separate from the pending-order lifetime (see stock-reservation.ts): a hold
// only keeps stock off the shelf while the shopper is paying.
export const HOLD_MINUTES = 15;

/** The payment window closes this long before the hold would expire (covers the delay of opening it and slow networks). */
export const CHECKOUT_WINDOW_MARGIN_SECONDS = 60;

/**
 * Razorpay Checkout `timeout` option (whole seconds, per Razorpay's docs): after this long the
 * customer can no longer pay in that window. A little shorter than the hold.
 */
export const CHECKOUT_WINDOW_SECONDS = HOLD_MINUTES * 60 - CHECKOUT_WINDOW_MARGIN_SECONDS;

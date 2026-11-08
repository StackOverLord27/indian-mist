/**
 * Pricing fallback constants.
 *
 * SERVER ONLY (used through src/lib/shipping-rules.ts). The browser never shows these values.
 * They are only used by the server when the database has no pricingSettings
 * (e.g. on first load or if the settings document doesn't exist yet).
 * The admin can override all of these live from Admin → Settings → Pricing.
 */

/** Flat shipping fee in INR when order is below threshold */
export const SHIPPING_COST = 99;

/** Order value above which shipping is free (in INR) */
export const SHIPPING_THRESHOLD = 999;

/** GST rate as a decimal fraction — currently disabled (no GST registration) */
// export const GST_RATE = 0.18;
export const GST_RATE = 0;

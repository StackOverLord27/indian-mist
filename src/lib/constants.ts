/**
 * Pricing fallback constants.
 *
 * These are only used when the database has not yet returned pricingSettings
 * (e.g. on first load or if the settings document doesn't exist yet).
 * The admin can override all of these live from Admin → Settings → Pricing.
 */

/** Flat shipping fee in INR when order is below threshold */
export const SHIPPING_COST = 99;

/** Order value above which shipping is free (in INR) */
export const SHIPPING_THRESHOLD = 999;

/** GST rate as a decimal fraction — 0.18 = 18% */
export const GST_RATE = 0.18;

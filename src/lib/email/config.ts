import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import type { SiteSettings } from "@/types/admin";
import type { ShopInfo } from "./types";
import { getEmailPolicy, getFallbackContactEmail, getSmtpConfig } from "@/lib/env";
import { SAFE_ADDRESS } from "./sanitize";

/** The one place for the sender's display names, the From address and the owner's address. */
export const SENDER_NAMES = { site: "Indian Mist", contact: "Indian Mist Website" } as const;

/** The From address: always the shop's own, SMTP_FROM (an address verified at the mail provider). */
export const getFromAddress = () => getSmtpConfig().from;

/**
 * Where the shop's own mail (contact-form messages) goes: the address saved in the admin
 * contact settings, else SUPER_ADMIN_EMAIL. Null when neither is set.
 */
export async function resolveOwnerAddress(): Promise<string | null> {
  await dbConnect();
  const settings = await SiteSettingsModel.findOne().lean<SiteSettings>();
  return settings?.contactPageSettings?.email || getFallbackContactEmail() || null;
}

/** How a customer can reach the shop (shown in the footer of every customer e-mail): the admin contact settings. */
export async function loadShopInfo(): Promise<ShopInfo> {
  await dbConnect();
  const settings = await SiteSettingsModel.findOne().lean<SiteSettings>();
  const contact = settings?.contactPageSettings;
  return {
    email: contact?.email || getFallbackContactEmail() || undefined,
    phone: contact?.phone || undefined,
    hours: contact?.businessHours || undefined,
  };
}

/** The admin switch for the optional "delivered" e-mail. Off unless the admin turned it on. */
export async function deliveredEmailEnabled(): Promise<boolean> {
  await dbConnect();
  const settings = await SiteSettingsModel.findOne().select("emailSettings").lean<SiteSettings>();
  return settings?.emailSettings?.sendDeliveredEmail === true;
}

export type Guard = { allowed: true } | { allowed: false; reason: "disabled" | "not-allowlisted" };

/**
 * May this address be e-mailed from this deployment? EMAIL_ENABLED=false stops everything.
 * Outside the live production deployment (Preview, local, `next start`) only addresses in
 * EMAIL_ALLOWLIST (exact address, or "@domain.com") may receive mail, so a test run can never
 * reach a real customer.
 */
export function checkRecipient(to: string): Guard {
  const policy = getEmailPolicy();
  if (!policy.enabled) return { allowed: false, reason: "disabled" };
  if (policy.production) return { allowed: true };
  const address = to.trim().toLowerCase();
  if (!SAFE_ADDRESS.test(address)) return { allowed: false, reason: "not-allowlisted" };
  const domain = address.slice(address.lastIndexOf("@"));
  const ok = policy.allowlist.some((entry) => (entry.startsWith("@") ? entry === domain : entry === address));
  return ok ? { allowed: true } : { allowed: false, reason: "not-allowlisted" };
}

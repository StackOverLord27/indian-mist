import { getSuperAdminEmailRaw } from "@/lib/env";

/**
 * The role names used in tokens, request headers and API responses.
 * The `role` field on the User model is NOT used for authorisation: the admin is the one
 * account whose email equals SUPER_ADMIN_EMAIL.
 */
export type TokenRole = "admin" | "user";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** True when `email` is the super-admin email. Both sides are trimmed and lower-cased. */
export function isSuperAdminEmail(email: string, superAdminEmail: string | undefined = getSuperAdminEmailRaw()): boolean {
  if (!superAdminEmail) return false;
  const configured = normalizeEmail(superAdminEmail);
  return configured !== "" && normalizeEmail(email) === configured;
}

/** The only place that decides a user's role. Used by sign-in, refresh, password reset and sign-up verification. */
export function roleForEmail(email: string, superAdminEmail?: string): TokenRole {
  return isSuperAdminEmail(email, superAdminEmail ?? getSuperAdminEmailRaw()) ? "admin" : "user";
}

/**
 * Which rate limiter applies to which API path. Kept free of Redis/Next imports so it can be
 * unit tested.
 *
 *  - "auth": credential and OTP endpoints. Strictest per-minute limit.
 *  - "form": public forms that send mail or write data (contact, newsletter). Very low limit.
 *  - "general": everything else under /api.
 */
export type LimiterKind = "auth" | "form" | "general";

// Matched as a path prefix on a segment boundary: "/api/auth/forgot-password" covers
// "/api/auth/forgot-password/request-otp" and "/reset", but not "/api/auth/forgot-passwordX".
const AUTH_PREFIXES = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
];
const FORM_PREFIXES = ["/api/contact", "/api/subscribe"];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/");

export function limiterKindForPath(pathname: string): LimiterKind {
  if (AUTH_PREFIXES.some((p) => matches(pathname, p))) return "auth";
  if (FORM_PREFIXES.some((p) => matches(pathname, p))) return "form";
  return "general";
}

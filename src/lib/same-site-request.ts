import type { NextRequest } from "next/server";

/**
 * True unless the request says it was sent from a page on another site.
 *
 * A browser always sends `Origin` on a cross-site POST, so that is checked first; `Referer` is the
 * fallback. A request with neither (a script, curl, an old browser) is not a cross-site browser
 * form, so it is allowed: this guards the cookie-clearing sign-out against a hostile page, it is
 * not authentication. Compared on the host the visitor used (behind Vercel that is the forwarded
 * host), so www/preview deployments work as long as the page and the API are the same host.
 */
export function isSameSiteRequest(req: NextRequest): boolean {
  const claimed = req.headers.get("origin") ?? req.headers.get("referer");
  if (!claimed) return true;
  const ownHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  try {
    return new URL(claimed).host === ownHost;
  } catch {
    return false; // "null" origin (sandboxed frame, privacy redirect) or garbage
  }
}

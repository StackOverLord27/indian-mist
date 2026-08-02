/**
 * proxy.ts  (Next.js 16 — replaces middleware.ts)
 *
 * Runs at the edge before every matched request.  Validates the access token
 * cookie via SubtleCrypto (no Node.js APIs) and either lets the request
 * through or redirects / rejects unauthenticated users.
 *
 * Protected routes:
 *   - All routes EXCEPT those listed as public below.
 *   - /api/* routes return 401 JSON (client calls /api/auth/refresh and retries).
 *   - Page routes redirect to /signin with a callbackUrl param.
 *
 * Token refresh is NOT done here — the edge runtime has no DB access.
 * The client is responsible for calling POST /api/auth/refresh when it
 * receives a 401, then retrying the original request.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenEdge } from "@/lib/auth-tokens.edge";
import { getAuthRateLimit, getGlobalApiRateLimit } from "@/lib/rate-limit";

// ─── Public & Protected paths ─────────────────────────────────────────────

const PUBLIC_API_PREFIXES = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/verify-otp",
  "/api/auth/refresh",
  "/api/auth/signout",
  "/api/products",
];

const PROTECTED_PAGE_PATHS = ["/checkout"];

// ─── Proxy function ───────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Rate Limiting (API routes only) — fail-open if Redis is unconfigured
  if (pathname.startsWith("/api/")) {
    try {
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

      // Determine which rate limiter to use
      const isAuthRoute = pathname.startsWith("/api/auth/");
      const ratelimit = isAuthRoute ? getAuthRateLimit() : getGlobalApiRateLimit();

      // If rate limiter is available (Redis configured), enforce limits
      if (ratelimit) {
        const { success, limit, remaining, reset } = await ratelimit.limit(ip);

        if (!success) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": limit.toString(),
                "X-RateLimit-Remaining": remaining.toString(),
                "X-RateLimit-Reset": reset.toString(),
              },
            }
          );
        }
      }
    } catch (error) {
      // Rate limiting failed (e.g. Redis down) — fail-open to preserve availability.
      // Log the error but don't block the request.
      console.warn("[proxy] Rate limiting unavailable:", error);
    }
  }

  // 2. Routing Logic for Pages vs APIs
  const isApiRoute = pathname.startsWith("/api/");
  
  if (isApiRoute) {
    // API Routes: Default deny, except PUBLIC_API_PREFIXES
    const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
    if (isPublicApi) {
      return NextResponse.next();
    }
  } else {
    // Page Routes: Default allow, except PROTECTED_PAGE_PATHS
    const isProtectedPage = PROTECTED_PAGE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isProtectedPage) {
      return NextResponse.next();
    }
  }

  const accessToken = req.cookies.get("access_token")?.value;
  const secret = process.env.JWT_ACCESS_SECRET ?? "";

  const payload = accessToken
    ? await verifyAccessTokenEdge(accessToken, secret)
    : null;

  if (!payload) {
    // API route — return JSON 401; client will refresh and retry.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Access token missing or expired" },
        { status: 401 }
      );
    }

    // Page route — redirect to /signin, preserving the intended destination.
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Token valid — forward identity to server components via request headers.
  // Server components can read these without re-verifying the JWT.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// ─── Matcher ──────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - /_next/static  (Next.js build artefacts)
     *   - /_next/image   (image optimisation)
     *   - Favicon, robots, sitemaps, and common static file extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

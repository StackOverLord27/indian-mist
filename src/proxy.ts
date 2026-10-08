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
  "/api/auth/forgot-password",
  "/api/products",
  "/api/blogs",
  "/api/settings",
  "/api/contact",
  "/api/subscribe",
  "/api/webhooks/razorpay",
];

const PUBLIC_PAGE_PATHS = ["/admin/login"];
const PROTECTED_PAGE_PATHS = ["/checkout", "/admin", "/profile"];

// ─── Proxy function ───────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Rate Limiting (API routes only) — fail-open if Redis is unconfigured
  if (pathname.startsWith("/api/")) {
    try {
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const isDev = process.env.NODE_ENV === "development";
      const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip.includes("127.0.0.1");

      // In development mode on localhost, skip aggressive rate limiting to prevent dev HMR lockouts
      if (!isDev || !isLocalhost) {
        // Only apply strict auth rate limiter to credential submission endpoints
        const isStrictAuthRoute =
          pathname === "/api/auth/signin" ||
          pathname === "/api/auth/signup" ||
          pathname === "/api/auth/verify-otp" ||
          pathname === "/api/auth/forgot-password";

        const ratelimit = isStrictAuthRoute
          ? getAuthRateLimit()
          : getGlobalApiRateLimit();

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
      }
    } catch (error) {
      // Rate limiting failed (e.g. Redis down) — fail-open to preserve availability.
      // Log the error but don't block the request.
      console.warn("[proxy] Rate limiting unavailable:", error);
    }
  }

  // Never trust identity headers sent by the client: only this proxy may set them.
  const cleanHeaders = new Headers(req.headers);
  cleanHeaders.delete("x-user-id");
  cleanHeaders.delete("x-user-email");
  cleanHeaders.delete("x-user-role");
  const passThrough = () => NextResponse.next({ request: { headers: cleanHeaders } });

  // 2. Routing Logic for Pages vs APIs
  const isApiRoute = pathname.startsWith("/api/");
  
  if (isApiRoute) {
    // API Routes: Default deny, except PUBLIC_API_PREFIXES
    const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
    if (isPublicApi) {
      return passThrough();
    }
  } else {
    // Page Routes: Default allow, except PROTECTED_PAGE_PATHS
    const isPublicPage = PUBLIC_PAGE_PATHS.some((p) => pathname === p);
    if (isPublicPage) {
      return passThrough();
    }

    const isProtectedPage = PROTECTED_PAGE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isProtectedPage) {
      return passThrough();
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

    // Page route — if user has a refresh_token cookie, allow the page to render
    // so client components (like AdminProtectedRoute) can silently refresh without redirecting!
    const refreshToken = req.cookies.get("refresh_token")?.value;
    if (refreshToken) {
      return passThrough();
    }

    // Page route — redirect to appropriate login page when no tokens exist.
    const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
    if (isAdminPage) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Token valid — forward identity to server components via request headers.
  // Server components can read these without re-verifying the JWT.
  const requestHeaders = new Headers(cleanHeaders);
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
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap.*|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

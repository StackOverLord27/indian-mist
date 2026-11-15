/**
 * auth-tokens.ts
 *
 * Central utility for all JWT signing / verification and cookie management.
 * Keeping everything here means token lifetimes, secrets, and cookie options
 * are defined in exactly one place.
 *
 * ⚠️  This module must NOT import any mongoose models — it runs in both Node
 *      (API routes) and edge (proxy) runtimes.  DB calls belong in the routes.
 */

import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import type { NextResponse } from "next/server";
import { getJwtAccessSecret, getJwtRefreshSecret, isProduction } from "@/lib/env";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_MAX_AGE = 60 * 15;           // 15 minutes (seconds)

const DAY = 60 * 60 * 24;

/**
 * Refresh-token (sign-in session) lifetimes, in seconds.
 *  - sliding: how long a session survives without being used; every renewal pushes it out again.
 *  - absolute: the session ends this long after it started, however often it is used.
 * The refresh token itself never changes during a session (no rotation): the cookie value stays,
 * only its expiry moves. The admin account (SUPER_ADMIN_EMAIL) gets the short pair.
 */
export const REFRESH_LIFETIME = {
  user: { sliding: 30 * DAY, absolute: 90 * DAY },
  admin: { sliding: 7 * DAY, absolute: 30 * DAY },
} as const;

export const refreshLifetimeFor = (role: "admin" | "user") => REFRESH_LIFETIME[role];

/** Most sessions kept per account; signing in beyond this ends the oldest ones. */
export const MAX_SESSIONS_PER_USER = 10;

// ─── Payload types ───────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  family: string; // login-session UUID — one per sign-in; sign-out ends the whole family
}

// ─── Token signing ───────────────────────────────────────────────────────────

// Tokens are signed and verified with HS256 only. Pinning the algorithm on verify means a token
// that claims another algorithm (including "none") is rejected.
const JWT_ALGORITHM = "HS256" as const;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtAccessSecret(), { expiresIn: ACCESS_TOKEN_MAX_AGE, algorithm: JWT_ALGORITHM });
}

/**
 * `absoluteSeconds` is the session's absolute maximum: the token's own `exp`. The sliding expiry
 * lives in the database row (and the cookie's Max-Age), because the token value never changes.
 */
export function signRefreshToken(payload: RefreshTokenPayload, absoluteSeconds: number): string {
  // A random id (jti) makes every token unique even when two are signed in the same second.
  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: absoluteSeconds, algorithm: JWT_ALGORITHM, jwtid: randomUUID() });
}

// ─── Token verification ──────────────────────────────────────────────────────

/** Throws if the token is missing, malformed, or expired. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtAccessSecret(), { algorithms: [JWT_ALGORITHM] }) as AccessTokenPayload;
}

/** Throws if the token is missing, malformed, or expired. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getJwtRefreshSecret(), { algorithms: [JWT_ALGORITHM] }) as RefreshTokenPayload;
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * SHA-256 hex hash of a raw token string.
 * We store only the hash in the DB so that a DB breach doesn't expose
 * usable refresh tokens.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Set both HTTP-only cookies on an existing NextResponse.
 * Call this from any route that issues tokens (signin, refresh).
 */
export function setTokenCookies(
  res: NextResponse | ReturnType<typeof import("next/server").NextResponse.json>,
  accessToken: string,
  refreshToken: string,
  refreshMaxAge: number, // seconds; always passed by the caller so an admin session can never get the customer lifetime by omission
): void {
  const base = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
  };

  (res as NextResponse).cookies.set("access_token", accessToken, {
    ...base,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  (res as NextResponse).cookies.set("refresh_token", refreshToken, {
    ...base,
    maxAge: refreshMaxAge,
    // Deliberately path "/", not "/api/auth/refresh": the proxy reads this cookie on ordinary page
    // loads (/admin, /checkout, /profile) to let a signed-in user with an expired access token
    // reach the page, where the client silently refreshes. A narrower path would hide the cookie
    // from those requests. It is httpOnly and sameSite "lax": scripts cannot read it, and other sites
    // can make the browser send it only on a top-level GET navigation (a link, a payment return),
    // never on a cross-site POST, fetch or embedded request.
  });
}

/** Set only the access cookie. */
export function setAccessTokenCookie(
  res: NextResponse | ReturnType<typeof import("next/server").NextResponse.json>,
  accessToken: string
): void {
  (res as NextResponse).cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

/**
 * Clear both auth cookies (used on signout or after a detected replay attack).
 */
export function clearTokenCookies(
  res: NextResponse | ReturnType<typeof import("next/server").NextResponse.json>
): void {
  const clear = { maxAge: 0, path: "/" };
  (res as NextResponse).cookies.set("access_token", "", clear);
  (res as NextResponse).cookies.set("refresh_token", "", {
    ...clear,
    path: "/",
  });
}

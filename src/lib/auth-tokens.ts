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
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

// ─── Payload types ───────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  family: string; // login-session UUID — used for family-wipe on replay
}

// ─── Token signing ───────────────────────────────────────────────────────────

// Tokens are signed and verified with HS256 only. Pinning the algorithm on verify means a token
// that claims another algorithm (including "none") is rejected.
const JWT_ALGORITHM = "HS256" as const;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m", algorithm: JWT_ALGORITHM });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  // A random id (jti) makes every token unique even when two are signed in the same second;
  // without it, a refresh right after sign-in produced the identical string (and the same hash).
  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: "7d", algorithm: JWT_ALGORITHM, jwtid: randomUUID() });
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
  refreshToken: string
): void {
  const base = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict" as const,
    path: "/",
  };

  (res as NextResponse).cookies.set("access_token", accessToken, {
    ...base,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  (res as NextResponse).cookies.set("refresh_token", refreshToken, {
    ...base,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    // Deliberately path "/", not "/api/auth/refresh": the proxy reads this cookie on ordinary page
    // loads (/admin, /checkout, /profile) to let a signed-in user with an expired access token
    // reach the page, where the client silently refreshes. A narrower path would hide the cookie
    // from those requests. It is httpOnly and sameSite "strict", so scripts and other sites
    // cannot read or send it.
  });
}

/** Set only the access cookie (used when a parallel refresh already rotated the refresh cookie). */
export function setAccessTokenCookie(
  res: NextResponse | ReturnType<typeof import("next/server").NextResponse.json>,
  accessToken: string
): void {
  (res as NextResponse).cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict" as const,
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

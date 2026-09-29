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
import { createHash } from "crypto";
import type { NextResponse } from "next/server";

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

// ─── Helpers — secret resolution ─────────────────────────────────────────────

function getAccessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET is not set");
  return s;
}

function getRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_REFRESH_SECRET is not set");
  return s;
}

// ─── Token signing ───────────────────────────────────────────────────────────

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: "15m" });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: "7d" });
}

// ─── Token verification ──────────────────────────────────────────────────────

/** Throws if the token is missing, malformed, or expired. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
}

/** Throws if the token is missing, malformed, or expired. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
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

const isProduction = process.env.NODE_ENV === "production";

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
    secure: isProduction,
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
    // Scope refresh token to / so proxy middleware can read it on page loads
    path: "/",
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

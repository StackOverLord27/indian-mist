import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
  setTokenCookies,
  clearTokenCookies,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-tokens";

export async function POST(req: NextRequest) {
  // The refresh token cookie is scoped to /api/auth/refresh so the browser
  // only sends it here — it's never exposed to any other API route.
  const rawToken = req.cookies.get("refresh_token")?.value;

  if (!rawToken) {
    return NextResponse.json(
      { error: "No refresh token provided" },
      { status: 401 }
    );
  }

  // ── 1. Verify JWT signature & expiry (stateless, no DB) ─────────────────
  let payload: { userId: string; family: string };
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    // Expired or tampered — clear cookies and reject.
    const res = NextResponse.json(
      { error: "Invalid or expired refresh token" },
      { status: 401 }
    );
    clearTokenCookies(res);
    return res;
  }

  // ── 2. Look up the hashed token in DB ────────────────────────────────────
  await dbConnect();
  const incomingHash = hashToken(rawToken);
  const storedToken = await RefreshToken.findOne({ tokenHash: incomingHash });

  if (!storedToken) {
    // Token not found — it was either already consumed (rotation) or never
    // existed.  This is a REPLAY ATTACK signal: wipe the entire family so all
    // other sessions derived from this login are also invalidated.
    console.warn(
      `[security] Refresh token replay detected — wiping family ${payload.family} for user ${payload.userId}`
    );
    await RefreshToken.deleteMany({
      userId: payload.userId,
      family: payload.family,
    });

    const res = NextResponse.json(
      { error: "Refresh token already used — please sign in again" },
      { status: 401 }
    );
    clearTokenCookies(res);
    return res;
  }

  // ── 3. Consume the old token (delete it) ─────────────────────────────────
  await RefreshToken.deleteOne({ _id: storedToken._id });

  // ── 4. Fetch fresh user data (role, isVerified may have changed) ─────────
  const user = await User.findById(payload.userId).select(
    "email role isVerified"
  );
  if (!user || !user.isVerified) {
    const res = NextResponse.json(
      { error: "User not found or account unverified" },
      { status: 401 }
    );
    clearTokenCookies(res);
    return res;
  }

  // ── 5. Issue rotated token pair ───────────────────────────────────────────
  // Reuse the same family UUID — it groups all rotations for this session.
  const { family } = payload;

  const userRole = user.email === process.env.SUPER_ADMIN_EMAIL ? 'admin' : user.role;

  const newAccessToken = signAccessToken({
    userId: String(user._id),
    email: user.email,
    role: userRole,
  });

  const newRawRefreshToken = signRefreshToken({ userId: String(user._id), family });

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(newRawRefreshToken),
    family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
  });

  // ── 6. Return new cookies ─────────────────────────────────────────────────
  const response = NextResponse.json(
    { message: "Token refreshed successfully" },
    { status: 200 }
  );
  setTokenCookies(response, newAccessToken, newRawRefreshToken);
  return response;
}

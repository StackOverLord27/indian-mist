import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { roleForEmail } from "@/lib/roles";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
  setTokenCookies,
  clearTokenCookies,
  refreshLifetimeFor,
} from "@/lib/auth-tokens";
import { pruneSessions, slidingExpiry } from "@/lib/auth-session";
import { logAuth, tokenAgeSeconds } from "@/lib/auth-log";

/**
 * Renewal. The refresh token does NOT rotate: a cookie that is present, whose hash is stored,
 * not expired and not revoked only yields a new access token; the refresh token and cookie keep
 * their value (the cookie's Max-Age moves with the sliding expiry). So a lost response, two tabs,
 * or a retry can never end a session. A session ends by: sign-out (that session), password reset
 * (all sessions), its sliding expiry, its absolute maximum, or the "10 newest sessions" cap.
 *
 * Every refusal logs one `[auth]` line with the reason (never a token, e-mail or id).
 */
export async function POST(req: NextRequest) {
  // The refresh cookie has path "/" (see setTokenCookies for why), so the browser sends it with
  // every same-site request. Only the proxy (does it exist?), this route and signout look at it.
  const rawToken = req.cookies.get("refresh_token")?.value;

  if (!rawToken) {
    logAuth("renewal refused", { reason: "no-refresh-cookie" });
    return NextResponse.json({ error: "No refresh token provided" }, { status: 401 });
  }

  const refuse = (error: string) => {
    const res = NextResponse.json({ error }, { status: 401 });
    clearTokenCookies(res);
    return res;
  };

  // ── 1. Verify JWT signature & expiry (stateless, no DB) ─────────────────
  let payload: { userId: string; family: string; iat?: number };
  try {
    payload = verifyRefreshToken(rawToken) as typeof payload;
  } catch (err) {
    const decoded = jwt.decode(rawToken);
    const age = tokenAgeSeconds(decoded && typeof decoded === "object" ? decoded.iat : undefined);
    logAuth("renewal refused", {
      reason: err instanceof jwt.TokenExpiredError ? "token-expired" : "token-invalid",
      tokenAgeSeconds: age,
    });
    return refuse("Invalid or expired refresh token");
  }
  const age = tokenAgeSeconds(payload.iat);

  try {
    await dbConnect();

    // ── 2. The token must still be stored (sign-out, password reset, the session cap and expiry delete it) ──
    const row = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
    if (!row || String(row.userId) !== payload.userId) {
      // No token text, no ids: only what helps tell "revoked by sign-out/reset" from "forged".
      console.warn(`[security] Refresh token unknown or revoked (token age ${age}s)`);
      return refuse("Session ended — please sign in again");
    }

    const now = Date.now();
    if (row.expiresAt.getTime() <= now) {
      logAuth("renewal refused", { reason: "session-idle-expired", tokenAgeSeconds: age });
      return refuse("Session expired — please sign in again");
    }
    if (row.absoluteExpiresAt && row.absoluteExpiresAt.getTime() <= now) {
      logAuth("renewal refused", { reason: "session-absolute-max-reached", tokenAgeSeconds: age });
      return refuse("Session expired — please sign in again");
    }

    // ── 3. Fresh user data (role and verification may have changed) ─────────
    const user = await User.findById(payload.userId).select("email isVerified");
    if (!user || !user.isVerified) {
      logAuth("renewal refused", { reason: "account-missing-or-unverified", tokenAgeSeconds: age });
      return refuse("User not found or account unverified");
    }

    const role = roleForEmail(user.email);
    const life = refreshLifetimeFor(role);
    const accessToken = signAccessToken({ userId: String(user._id), email: user.email, role });

    // ── 4. Sessions from before tokens stopped rotating (no absolute maximum stored) ──
    // Their token expires after the old 7 days and cannot be extended in place, so the first
    // renewal swaps it, once, for a new-format token in the same session. The old row stays
    // until it expires, so a lost response here costs nothing: the old cookie still works.
    if (!row.absoluteExpiresAt) {
      const absoluteExpiresAt = new Date(now + life.absolute * 1000);
      const upgraded = signRefreshToken({ userId: String(user._id), family: row.family }, life.absolute);
      await RefreshToken.create({
        userId: user._id,
        tokenHash: hashToken(upgraded),
        family: row.family,
        expiresAt: slidingExpiry(now, life.sliding, absoluteExpiresAt),
        absoluteExpiresAt,
        lastUsedAt: new Date(now),
      });
      await pruneSessions(user._id).catch(() => {});
      const res = NextResponse.json({ message: "Token refreshed successfully" }, { status: 200 });
      setTokenCookies(res, accessToken, upgraded, life.sliding);
      return res;
    }

    // ── 5. Slide the expiry (never shortened by an out-of-order parallel renewal) ──
    const expiresAt = slidingExpiry(now, life.sliding, row.absoluteExpiresAt);
    await RefreshToken.updateOne(
      { _id: row._id },
      { $max: { expiresAt }, $set: { lastUsedAt: new Date(now) } },
    );

    // Same refresh token, cookie lifetime moved to the new expiry
    const res = NextResponse.json({ message: "Token refreshed successfully" }, { status: 200 });
    const cookieSeconds = Math.max(1, Math.floor((expiresAt.getTime() - now) / 1000));
    setTokenCookies(res, accessToken, rawToken, cookieSeconds);
    return res;
  } catch (error) {
    // A database or other server failure is NOT a sign-out: leave the cookies alone and say 503,
    // the client keeps the session and offers a retry.
    console.error("[auth] renewal failed: server error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again." }, { status: 503 });
  }
}

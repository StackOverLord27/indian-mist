import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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
  setAccessTokenCookie,
  clearTokenCookies,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-tokens";

// A second refresh with a token that was exchanged this recently is treated as a parallel request
// (two tabs), not as a replay. 10 s is long enough for a slow database round trip.
const PARALLEL_REFRESH_GRACE_MS = 10_000;

export async function POST(req: NextRequest) {
  // The refresh cookie has path "/" (see setTokenCookies for why), so the browser sends it with
  // every same-site request. Only the proxy (does it exist?), this route and signout look at it.
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

  // ── 2. Claim the token (one atomic step) ──────────────────────────────
  // findOneAndUpdate with "not used yet" in the filter lets exactly ONE of several parallel
  // requests (two tabs, the admin's retry queue) rotate this token; before, both could succeed,
  // or the slower one looked like a replay and signed the user out everywhere.
  await dbConnect();
  const incomingHash = hashToken(rawToken);
  const now = new Date();
  const storedToken = await RefreshToken.findOneAndUpdate(
    { tokenHash: incomingHash, usedAt: { $exists: false } },
    { $set: { usedAt: now } },
    { new: false },
  );

  if (!storedToken) {
    // Already used, or never existed. If it was used a moment ago, this is a parallel request
    // from the same browser: the winner has set the new refresh cookie, so this request only
    // gets a fresh access token (the refresh cookie is left alone).
    const used = await RefreshToken.findOne({ tokenHash: incomingHash }).select("usedAt userId").lean();
    if (used?.usedAt && now.getTime() - used.usedAt.getTime() <= PARALLEL_REFRESH_GRACE_MS) {
      const user = await User.findById(payload.userId).select("email isVerified");
      if (user?.isVerified) {
        const res = NextResponse.json({ message: "Token refreshed successfully" }, { status: 200 });
        setAccessTokenCookie(
          res,
          signAccessToken({ userId: String(user._id), email: user.email, role: roleForEmail(user.email) }),
        );
        return res;
      }
    }

    // A used token outside the grace window, or one that does not exist, is a REPLAY signal:
    // wipe the entire family so all sessions derived from this login are invalidated.
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

  // ── 3. Fetch fresh user data (role, isVerified may have changed) ─────────
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

  const userRole = roleForEmail(user.email);

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

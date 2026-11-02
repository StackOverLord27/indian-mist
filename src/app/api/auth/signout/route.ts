import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { RefreshToken } from "@/models/refreshToken.model";
import { clearTokenCookies, hashToken, verifyRefreshToken } from "@/lib/auth-tokens";

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get("refresh_token")?.value;

  // Best-effort DB cleanup: if we have a valid token, end this whole login session (every
  // rotation of it), not just the newest token. We still clear cookies even if the token is
  // missing/expired (user may have an access token but an already-expired refresh token).
  if (rawToken) {
    try {
      const payload = verifyRefreshToken(rawToken); // guard: only hit DB with a structurally valid token
      await dbConnect();
      await RefreshToken.deleteMany({
        $or: [{ tokenHash: hashToken(rawToken) }, { userId: payload.userId, family: payload.family }],
      });
    } catch {
      // Token already expired or malformed — DB record will be reaped by TTL.
      // Nothing to do; proceed to clear cookies.
    }
  }

  const response = NextResponse.json(
    { message: "Signed out successfully" },
    { status: 200 }
  );

  clearTokenCookies(response);
  return response;
}

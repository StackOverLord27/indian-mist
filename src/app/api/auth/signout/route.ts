import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { RefreshToken } from "@/models/refreshToken.model";
import { isSameSiteRequest } from "@/lib/same-site-request";
import { clearTokenCookies, hashToken, verifyRefreshToken } from "@/lib/auth-tokens";

export async function POST(req: NextRequest) {
  // another site must not be able to sign a visitor out (SameSite=Lax already keeps cookies off a
  // cross-site POST, so this is a second lock on the same door)
  if (!isSameSiteRequest(req)) {
    console.warn("[auth] sign-out refused: request came from another site");
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }

  const rawToken = req.cookies.get("refresh_token")?.value;

  // End THIS session: the presented token's row and every row of its session (family). Other
  // sessions of the account (other devices) are untouched. Cookies are cleared in every case,
  // including a missing or expired token. A failure of the database is logged, never shown.
  if (rawToken) {
    let session: { userId: string; family: string } | null = null;
    try {
      session = verifyRefreshToken(rawToken); // only a genuine token may name a session to end
    } catch {
      // Expired or malformed: only its own row (if any) can be removed; the TTL reaps the rest
    }
    try {
      await dbConnect();
      await RefreshToken.deleteMany({
        $or: [{ tokenHash: hashToken(rawToken) }, ...(session ? [{ userId: session.userId, family: session.family }] : [])],
      });
    } catch (error) {
      console.error("[auth] sign-out could not end the session in the database:", error instanceof Error ? error.message : "unknown");
    }
  }

  const response = NextResponse.json(
    { message: "Signed out successfully" },
    { status: 200 }
  );

  clearTokenCookies(response);
  return response;
}

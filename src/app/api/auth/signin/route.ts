import { NextResponse } from "next/server";
import { isBlocked, recordFailure, clearAttempts } from "@/lib/attempt-limit";
import { randomUUID } from "crypto";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setTokenCookies,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-tokens";
import { SignInSchema } from "@/schemas/auth/signin.schema";

const MAX_LOGIN_FAILURES = 10;
const LOGIN_WINDOW_SEC = 15 * 60;

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const parseResult = SignInSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email or password format" },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // Stop password guessing on a single account, even when the attacker rotates IP addresses
    const attemptKey = `login:${email}`;
    if (await isBlocked(attemptKey, MAX_LOGIN_FAILURES)) {
      return NextResponse.json(
        { error: "Too many failed sign-in attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // ── Validate credentials ───────────────────────────────────────────────
    const user = await User.findOne({ email });
    if (!user) {
      await recordFailure(attemptKey, LOGIN_WINDOW_SEC);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Please verify your email via OTP before signing in" },
        { status: 403 }
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await recordFailure(attemptKey, LOGIN_WINDOW_SEC);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await clearAttempts(attemptKey);

    // ── Issue tokens ───────────────────────────────────────────────────────
    // Each login creates a new "family" — a UUID that groups all refresh-token
    // rotations for this session. If a consumed refresh token from a family is
    // ever replayed, the entire family is wiped (see /api/auth/refresh).
    const family = randomUUID();

    const userRole = email === process.env.SUPER_ADMIN_EMAIL ? 'admin' : 'user';

    const accessToken = signAccessToken({
      userId: String(user._id),
      email: user.email,
      role: userRole,
    });

    const rawRefreshToken = signRefreshToken({
      userId: String(user._id),
      family,
    });

    // Persist only the hash — never store the raw refresh token in the DB.
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(rawRefreshToken),
      family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    });

    // ── Build response ─────────────────────────────────────────────────────
    const response = NextResponse.json(
      {
        message: "Signed in successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: userRole,
        },
      },
      { status: 200 }
    );

    setTokenCookies(response, accessToken, rawRefreshToken);
    return response;
  } catch (error: unknown) {
    console.error("Signin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

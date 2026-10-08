import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { verifyOtp, deleteOtp } from "@/lib/otp-store";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setTokenCookies,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-tokens";
import { ResetPasswordSchema } from "@/schemas/auth/forgot-password.schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = ResetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, otp, newPassword } = parseResult.data;

    // Verify OTP via Redis
    const validOtpData = await verifyOtp(email, otp);
    if (!validOtpData) {
      return NextResponse.json(
        { error: "Invalid or expired OTP. Please request a new one." },
        { status: 400 }
      );
    }

    await dbConnect();

    // Fetch User
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // Update password (triggers pre-save hook for hashing)
    user.password = newPassword;
    await user.save();

    // Clean up OTP
    await deleteOtp(email);

    // ── Issue fresh tokens and auto-signin ─────────────────────────────────────
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

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(rawRefreshToken),
      family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    });

    const response = NextResponse.json(
      {
        message: "Password reset successfully. Signing you in...",
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
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

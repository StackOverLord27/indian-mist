import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { verifyOtp, deleteOtp } from "@/lib/otp-store";
import { setTokenCookies } from "@/lib/auth-tokens";
import { startSession } from "@/lib/auth-session";
import { ResetPasswordSchema } from "@/schemas/auth/forgot-password.schema";
import { queuePasswordChangedEmail } from "@/lib/email/order-mail";

export const maxDuration = 60; // the notice e-mail goes out after the response

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
    const validOtpData = await verifyOtp("reset", email, otp);
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
    await deleteOtp("reset", email);

    // A password reset must end every existing session (including any stolen one)
    await RefreshToken.deleteMany({ userId: user._id });

    // The password is changed: tell the owner of the account (after the response, never fails the reset)
    await queuePasswordChangedEmail({ id: user._id, email: user.email, name: user.name });

    // ── Issue a fresh session and auto-signin ──────────────────────────────────
    const { role: userRole, accessToken, refreshToken: rawRefreshToken, refreshMaxAge } = await startSession(user);

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

    setTokenCookies(response, accessToken, rawRefreshToken, refreshMaxAge);
    return response;
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

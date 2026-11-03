import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { RefreshToken } from "@/models/refreshToken.model";
import { verifyOtp, deleteOtp } from "@/lib/otp-store";
import { roleForEmail } from "@/lib/roles";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setTokenCookies,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-tokens";

const VerifyOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    await dbConnect();
    const parsed = VerifyOtpSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email and a 6-digit OTP are required" },
        { status: 400 }
      );
    }
    const { email, otp } = parsed.data;

    // Verify the OTP in Redis
    const otpData = await verifyOtp("signup", email, otp);

    if (!otpData) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // Guard against race conditions / double submissions:
    // If a user already exists with this email, don't create a duplicate.
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      await deleteOtp("signup", email);
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    if (!otpData.name || !otpData.password) {
      // A sign-up code always carries both; anything else is not a sign-up in progress
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // OTP is valid. Create the user in ONE write, with the password already hashed (bcrypt, when
    // the code was requested). insertMany does not run the model's save hook, which would hash
    // the hash again. Before, the user was saved without a password and the password was set in
    // a second write, so a crash in between left a verified account nobody could sign in to, and
    // the same e-mail could not sign up again.
    let newUser;
    try {
      [newUser] = await User.insertMany([
        { name: otpData.name, email, password: otpData.password, isVerified: true },
      ]);
    } catch (error) {
      // Two verifications at the same moment: the other one created the account
      if ((error as { code?: number } | null)?.code === 11000) {
        await deleteOtp("signup", email);
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }
      throw error;
    }

    // Consume the OTP immediately so it cannot be replayed.
    await deleteOtp("signup", email);

    // Issue tokens — log the user in automatically, no need to sign in again.
    const family = randomUUID();

    const userRole = roleForEmail(newUser.email);

    const accessToken = signAccessToken({
      userId: String(newUser._id),
      email: newUser.email,
      role: userRole,
    });

    const rawRefreshToken = signRefreshToken({
      userId: String(newUser._id),
      family,
    });

    await RefreshToken.create({
      userId: newUser._id,
      tokenHash: hashToken(rawRefreshToken),
      family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    });

    const response = NextResponse.json(
      {
        message: "Email verified. Welcome to Indian Mist!",
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: userRole,
        },
      },
      { status: 200 }
    );

    setTokenCookies(response, accessToken, rawRefreshToken);
    return response;
  } catch (error: unknown) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

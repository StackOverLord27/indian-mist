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

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    // Verify the OTP in Redis
    const otpData = await verifyOtp(email, otp);

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
      await deleteOtp(email);
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    // OTP is valid. Now we create the user in the database.
    // The password stored in Redis is ALREADY hashed (bcrypt), so we
    // must bypass the User model's pre-save hook to avoid double-hashing.
    // We do this by creating the document and then setting the password
    // field directly (isModified('password') will be true, but we skip
    // the hook by using updateOne after initial save without password).
    const newUser = new User({
      name: otpData.name,
      email: email,
      isVerified: true,
    });

    // Save first without password (triggers pre-save but password is empty, hook skips)
    await newUser.save();

    // Set the pre-hashed password directly, bypassing the pre-save hook
    await User.updateOne(
      { _id: newUser._id },
      { $set: { password: otpData.password } }
    );

    // Consume the OTP immediately so it cannot be replayed.
    await deleteOtp(email);

    // Issue tokens — log the user in automatically, no need to sign in again.
    const family = randomUUID();

    const accessToken = signAccessToken({
      userId: String(newUser._id),
      email: newUser.email,
      role: newUser.role,
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
          role: newUser.role,
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

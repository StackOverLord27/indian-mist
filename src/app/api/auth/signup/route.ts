import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { setOtp, deleteOtp } from "@/lib/otp-store";
import { allowOtpEmail } from "@/lib/attempt-limit";
import { sendMail } from "@/lib/email";
import { SignUpSchema } from "@/schemas/auth/signup.schema";

// A send is capped at 15 s and a sign-in code gets one immediate second try (src/lib/email).
export const maxDuration = 60;

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses Node's crypto.randomInt which is backed by a CSPRNG,
 * unlike Math.random() which is predictable.
 */
function generateOTP(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const parseResult = SignUpSchema.safeParse(body);

    if (!parseResult.success) {
      // Combine all Zod error messages into a single readable string
      const errorMessage = parseResult.error.issues
        .map((err) => err.message)
        .join(". ");
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { name, email, password } = parseResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      );
    }

    // One address cannot be flooded with verification e-mails
    if (!(await allowOtpEmail("signup", email))) {
      return NextResponse.json(
        { error: "Too many verification emails requested for this address. Please try again later." },
        { status: 429 }
      );
    }

    // Hash the password BEFORE storing in Redis so that plaintext
    // passwords are never persisted in any intermediate storage.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP, store the hashed password + user payload in Redis, and send via email.
    // We DO NOT save the user to the database here — that happens after OTP verification.
    const otpCode = generateOTP();
    await setOtp("signup", email, otpCode, name, hashedPassword);

    const sent = await sendMail("otp-signup", email, { otp: otpCode });

    if (sent.status !== "sent") {
      // Not delivered (permanently failed, still failing after the one immediate retry, or held
      // back by the e-mail guard): the code is useless, so delete it and let the customer ask again.
      await deleteOtp("signup", email);
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "OTP sent successfully. Please verify your email.",
        email: email,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

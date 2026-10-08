import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { setOtp, checkOtpExists } from "@/lib/otp-store";
import { sendOTPVerificationEmail } from "@/lib/mailer";
import { RequestOtpSchema } from "@/schemas/auth/forgot-password.schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = RequestOtpSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parseResult.data;

    await dbConnect();

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email address." },
        { status: 404 }
      );
    }

    // Check if an OTP request is already pending to prevent overwriting/spam
    const otpExists = await checkOtpExists(email);
    if (otpExists) {
      return NextResponse.json(
        { error: "An OTP request is already pending for this email. Please check your inbox or wait 5 minutes before trying again." },
        { status: 429 }
      );
    }

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the OTP in Upstash Redis (5 min TTL)
    await setOtp(email, otp);

    // Send the OTP email
    const emailSent = await sendOTPVerificationEmail(email, otp);
    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "OTP sent successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

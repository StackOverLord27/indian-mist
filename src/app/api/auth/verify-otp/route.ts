import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { User } from "@/models/User";
import { Otp } from "@/models/Otp";

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

    // Find the OTP in the database
    const otpRecord = await Otp.findOne({ email, otp });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // OTP is valid. Update the user's verification status
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    user.isVerified = true;
    await user.save();

    // Consume the OTP immediately so it cannot be replayed within its TTL window.
    // MongoDB's TTL index handles natural expiry (5 min); this deletion is for
    // security — a successfully used OTP must not remain valid for the rest of
    // its lifetime. This is the only place in the codebase that manually deletes
    // an OTP document; all other cleanup is delegated to the TTL monitor.
    await Otp.deleteOne({ _id: otpRecord._id });

    return NextResponse.json(
      { message: "Email verified successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

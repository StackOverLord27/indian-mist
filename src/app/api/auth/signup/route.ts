import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { User } from "@/models/User";
import { Otp } from "@/models/Otp";

// A simple utility to generate a 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      );
    }

    // Create the user (isVerified will be false by default as per schema)
    const newUser = new User({
      name,
      email,
      password,
    });
    await newUser.save();

    // Generate and upsert OTP.
    // Using findOneAndReplace+upsert (instead of a bare create) ensures there is
    // always exactly one OTP document per email. When a user resends, this
    // atomically replaces the old document with a fresh one, which resets the
    // createdAt field and therefore resets MongoDB's TTL clock automatically.
    // No manual deletion of the old OTP is needed.
    const otpCode = generateOTP();
    await Otp.findOneAndReplace(
      { email },
      { email, otp: otpCode, createdAt: new Date() },
      { upsert: true }
    );

    // In a real application, you would send this OTP via Email or SMS here.
    // For demonstration, we'll log it and return a success message.
    console.log(`[DEV ONLY] OTP for ${email} is ${otpCode}`);

    return NextResponse.json(
      {
        message: "User registered successfully. Please verify your OTP.",
        email: newUser.email,
        // Remove this in production!
        dev_otp: otpCode,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

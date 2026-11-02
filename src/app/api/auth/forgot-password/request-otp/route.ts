import { NextResponse, after } from "next/server";
import { randomInt } from "crypto";
import dbConnect from "@/lib/db";
import { User } from "@/models/user.model";
import { setOtp, deleteOtp, checkOtpExists } from "@/lib/otp-store";
import { allowOtpEmail } from "@/lib/attempt-limit";
import { requireRedis } from "@/lib/redis";
import { sendOTPVerificationEmail } from "@/lib/mailer";
import { RequestOtpSchema } from "@/schemas/auth/forgot-password.schema";

// The same answer whether or not an account exists, so this form cannot be used to find out
// who has an account.
const GENERIC_SUCCESS = {
  message: "If an account exists for that email, we've sent a verification code.",
};

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parseResult = RequestOtpSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parseResult.data;

    await dbConnect();

    // One address cannot be flooded with codes. Counted for every request, whether or not an
    // account exists, so hitting the limit reveals nothing either.
    if (!(await allowOtpEmail("reset", email))) {
      return NextResponse.json(
        { error: "Too many code requests for this email address. Please try again later." },
        { status: 429 }
      );
    }

    const user = await User.findOne({ email }).select("_id").lean();
    // Same Redis read for both cases, so the two paths take about the same time
    const pending = await checkOtpExists("reset", email);

    if (user && !pending) {
      const otp = randomInt(100_000, 1_000_000).toString();
      await setOtp("reset", email, otp);

      // Send after the response so a slow or failing mail server cannot reveal (through timing
      // or an error) that this address has an account.
      after(async () => {
        const sent = await sendOTPVerificationEmail(email, otp);
        if (!sent) {
          // Let the person ask again instead of waiting for a code that was never delivered
          await deleteOtp("reset", email).catch((error) =>
            console.error("Forgot password: could not clear unsent code:", error)
          );
        }
      });
    } else if (!user) {
      // Mirror setOtp's two Redis writes for an address with no account
      const redis = requireRedis();
      await redis.set(`otp_decoy:${email}`, "1", { ex: 5 });
      await redis.del(`otp_decoy_attempts:${email}`);
    }
    // user exists and a code is already pending: send nothing new, answer the same way

    return NextResponse.json(GENERIC_SUCCESS, { status: 200 });
  } catch (error) {
    console.error("Forgot password request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

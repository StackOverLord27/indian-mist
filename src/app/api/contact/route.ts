import { NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/lib/email";
import { resolveOwnerAddress } from "@/lib/email/config";
import { allowContactEmail } from "@/lib/attempt-limit";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

// A send is capped at 15 s (src/lib/email); the rest of the request is a few database and Redis calls.
export const maxDuration = 60;

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Please enter a valid email address").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  topic: z.enum(CONTACT_TOPICS),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (at least 10 characters)")
    .max(2000, "Message is too long"),
  website: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { website, ...data } = result.data;

    // Honeypot: real users never fill this hidden field
    if (website) {
      return NextResponse.json({ message: "Message sent" }, { status: 200 });
    }

    const to = await resolveOwnerAddress();

    if (!to) {
      return NextResponse.json(
        { message: "Contact email is not configured." },
        { status: 500 }
      );
    }

    // Across ALL senders: protects the owner's inbox and the mail provider's daily allowance
    const cap = await allowContactEmail();
    if (!cap.allowed) {
      console.warn(`[contact] global e-mail cap reached (${cap.window}): message not sent`);
      return NextResponse.json(
        { message: "We're receiving a lot of messages right now. Please try again in a little while, or message us on WhatsApp." },
        { status: 429 }
      );
    }

    const sent = await sendMail("contact", to, data);

    if (sent.status !== "sent" && sent.status !== "duplicate") {
      return NextResponse.json(
        { message: "We couldn't send your message. Please try WhatsApp or email us directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: "Message sent" }, { status: 200 });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

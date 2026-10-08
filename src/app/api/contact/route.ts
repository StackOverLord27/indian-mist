import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { sendContactMessageEmail } from "@/lib/mailer";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

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

    await dbConnect();
    const settings = (await SiteSettingsModel.findOne().lean()) as any;
    const to =
      settings?.contactPageSettings?.email ||
      process.env.SUPER_ADMIN_EMAIL ||
      process.env.SMTP_USER;

    if (!to) {
      return NextResponse.json(
        { message: "Contact email is not configured." },
        { status: 500 }
      );
    }

    const sent = await sendContactMessageEmail({ to, ...data });

    if (!sent) {
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

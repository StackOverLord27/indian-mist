import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@indianmist.com";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function sendContactMessageEmail(input: {
  to: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
}) {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const phone = input.phone ? escapeHtml(input.phone) : "—";
  const topic = escapeHtml(input.topic);
  const message = escapeHtml(input.message).replace(/\n/g, "<br/>");

  const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#283618;">
  <h2 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 16px;">New enquiry: ${topic}</h2>
  <table cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;margin-bottom:20px;">
    <tr><td style="padding-right:16px;color:#7a7a5a;">Name</td><td>${name}</td></tr>
    <tr><td style="padding-right:16px;color:#7a7a5a;">Email</td><td><a href="mailto:${email}" style="color:#606c38;">${email}</a></td></tr>
    <tr><td style="padding-right:16px;color:#7a7a5a;">Phone</td><td>${phone}</td></tr>
  </table>
  <div style="background:#fdf6e3;border:1px solid #e8dfc8;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;">${message}</div>
  <p style="font-size:12px;color:#9e9e8e;margin-top:20px;">Reply directly to this email to respond to the customer.</p>
</div>`;

  const text = `New enquiry: ${input.topic}\n\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone || "—"}\n\n${input.message}`;

  try {
    await transporter.sendMail({
      from: `"Indian Mist Website" <${SMTP_FROM}>`,
      to: input.to,
      replyTo: input.email,
      subject: `[Contact] ${input.topic} — ${input.name}`.replace(/[\r\n]+/g, " "),
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("[MAILER] Error sending contact message:", error);
    return false;
  }
}

export async function sendOTPVerificationEmail(email: string, otp: string) {
  // Render OTP as a single styled block
  const digits = `<span style="display:inline-block;padding:12px 24px;text-align:center;letter-spacing:6px;font-size:32px;font-weight:700;font-family:'Georgia',serif;color:#3b4a2f;background:#f7f3e8;border:2px solid #c8b89a;border-radius:8px;">${otp}</span>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email – Indian Mist</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f3e8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3e8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Wordmark header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:#4a5e35;border-radius:50%;text-align:center;line-height:36px;font-size:18px;">
                    🌿
                  </td>
                  <td style="padding-left:10px;font-family:'Georgia',serif;font-size:20px;color:#3b4a2f;letter-spacing:1px;">
                    Indian Mist
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(59,74,47,0.08);">
              <!-- Gradient stripe -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="4" style="background:linear-gradient(90deg,#4a5e35 0%,#b5783a 50%,#7a3b2e 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:44px 48px 40px;">

                <!-- Envelope icon -->
                <tr>
                  <td align="center" style="padding-bottom:20px;font-size:36px;line-height:1;">
                    ✉️
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <h1 style="margin:0;font-family:'Georgia',serif;font-size:26px;font-weight:normal;color:#3b4a2f;">
                      Verify your email
                    </h1>
                  </td>
                </tr>

                <!-- Subtitle -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <p style="margin:0;font-size:14px;color:#7a7a6a;line-height:1.6;max-width:340px;text-align:center;">
                      Use the one-time code below to complete your<br/>Indian Mist registration.
                      This code expires in <strong style="color:#4a5e35;">5 minutes</strong>.
                    </p>
                  </td>
                </tr>

                <!-- OTP box -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <table cellpadding="0" cellspacing="0" style="background:#f7f3e8;border:1px solid #e0d5c0;border-radius:10px;">
                      <tr>
                        <td style="padding:24px 32px;">
                          ${digits}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td height="1" style="background:#e8dfc8;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security note -->
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background:#fdfaf4;border:1px solid #e8dfc8;border-radius:8px;max-width:380px;width:100%;">
                      <tr>
                        <td style="padding:14px 20px;font-size:12px;color:#7a7a6a;line-height:1.7;">
                          🔒&nbsp;&nbsp;If you didn't create an Indian Mist account, you can safely ignore this email. Never share this code with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 8px;font-size:11px;color:#9e9e8e;line-height:1.7;">
              © ${new Date().getFullYear()} Indian Mist. All rights reserved.<br/>
              This email was sent to <a href="mailto:${email}" style="color:#4a5e35;text-decoration:none;">${email}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your Indian Mist verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, you can safely ignore this email.`;

  try {
    const info = await transporter.sendMail({
      from: `"Indian Mist" <${SMTP_FROM}>`,
      to: email,
      subject: "Your Indian Mist verification code",
      text,
      html,
    });
    console.log(`[MAILER] OTP email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[MAILER] Error sending OTP email:", error);
    return false;
  }
}

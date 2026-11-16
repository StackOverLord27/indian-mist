/** The e-mails the shop sends. Add a type here, then a template in templates.ts. */
export type EmailType = "otp-signup" | "otp-reset" | "contact";

export type EmailData = {
  "otp-signup": { otp: string };
  "otp-reset": { otp: string };
  contact: { name: string; email: string; phone?: string; topic: string; message: string };
};

export type MailMessage = {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  messageId?: string;
};

export type MailError = {
  /** retryable: 4xx replies and network trouble. permanent: 5xx replies, bad address, bad setup. */
  kind: "retryable" | "permanent";
  /** An SMTP reply code (as text) or an error code. Never a message, recipient or secret. */
  code: string;
};

export type SendOutcome = { ok: true; id: string } | { ok: false; error: MailError };

/** Everything the rest of the code needs from a mail provider. Swap the provider by swapping this. */
export interface MailTransport {
  send(message: MailMessage): Promise<SendOutcome>;
}

export type SendMailResult =
  | { status: "sent" }
  | { status: "duplicate" } // the same (type, related id) was already claimed: nothing sent
  | { status: "dropped"; reason: "disabled" | "not-allowlisted" } // guard: nothing sent, on purpose
  | { status: "failed"; retryable: boolean; code: string };

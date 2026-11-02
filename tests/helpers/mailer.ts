import { vi } from "vitest";

export type SentMail = { to?: string; from?: string; subject?: string; html?: string; text?: string };
export const sentMails: SentMail[] = [];
export const mailState = { failNext: false };
export const resetMailer = () => { sentMails.length = 0; mailState.failNext = false; };

/** Mocks `nodemailer` (src/lib/mailer.ts calls createTransport at import). */
export function nodemailerModuleMock() {
  const sendMail = vi.fn(async (mail: SentMail) => {
    if (mailState.failNext) { mailState.failNext = false; throw new Error("mock SMTP failure"); }
    sentMails.push(mail);
    return { messageId: `<mock-${sentMails.length}@test>` };
  });
  const createTransport = vi.fn(() => ({ sendMail }));
  return { default: { createTransport }, createTransport };
}

/* vi.mock("nodemailer", async () => (await import("./helpers/mailer")).nodemailerModuleMock()); */

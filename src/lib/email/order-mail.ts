import { after } from "next/server";
import { loadShopInfo, deliveredEmailEnabled } from "./config";
import { sendMail } from "./index";
import { buildOrderMail, passwordChangedId } from "./order-data";
import type { OrderEmailType, SendMailResult } from "./types";

/**
 * How the rest of the app sends the customer's e-mails. Three rules apply to every call:
 *  1. It is called AFTER the database change has been saved, and never throws: a status change or an
 *     order is never undone or failed because mail failed.
 *  2. It runs after the response (`after()`), so a slow mail server does not hold the customer or
 *     the admin. Outside a request (a script, a test) it simply runs now.
 *  3. Exactly once: the order id is the dedupe key, so two code paths, a double click or a retry
 *     cannot send the same e-mail twice.
 */

/** Run `task` after the response is sent; outside a request scope, run it now. Never throws. */
export async function afterResponse(task: () => Promise<unknown>): Promise<void> {
  const safe = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[email] background task failed: ${error instanceof Error ? error.name : "error"}`);
    }
  };
  try {
    after(safe);
  } catch {
    await safe();
  }
}

/** Builds the e-mail from the saved order and sends it. The result is for tests and logs; callers ignore it. */
export async function sendOrderEmail(type: OrderEmailType, orderId: unknown): Promise<SendMailResult> {
  try {
    const id = String(orderId);
    const built = await buildOrderMail(id);
    if (!built) {
      console.warn(`[email] not sent type=${type}: the order or its account has no address`);
      return { status: "failed", retryable: false, code: "ENOSOURCE" };
    }
    return await sendMail(type, built.to, built.data, { relatedId: id });
  } catch (error) {
    console.error(`[email] could not prepare type=${type}: ${error instanceof Error ? error.name : "error"}`);
    return { status: "failed", retryable: false, code: "EUNEXPECTED" };
  }
}

export const queueOrderEmail = (type: OrderEmailType, orderId: unknown) => afterResponse(() => sendOrderEmail(type, orderId));

/** "Delivered" is optional: only when the admin switched it on in the site settings. */
export const queueDeliveredEmail = (orderId: unknown) =>
  afterResponse(async () => {
    if (await deliveredEmailEnabled()) await sendOrderEmail("order-delivered", orderId);
  });

/** A short security notice after a password reset. Every change is its own e-mail. */
export const queuePasswordChangedEmail = (user: { id: unknown; email: string; name?: string }) => {
  const changedAt = Date.now();
  return afterResponse(async () => {
    const shop = await loadShopInfo();
    await sendMail("password-changed", user.email, { name: user.name ?? "", changedAt: new Date(changedAt).toISOString(), shop }, { relatedId: passwordChangedId(user.id, changedAt) });
  });
};

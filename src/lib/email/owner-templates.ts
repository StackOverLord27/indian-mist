import { getSiteUrl } from "@/lib/env";
import { orderNumber } from "@/lib/order-number";
import { formatShopDate } from "@/lib/shop-time";
import { emailTypeLabel } from "@/lib/email-labels";
import { SENDER_NAMES } from "./config";
import { COLORS, button, esc, layout, noticeBox, paragraph, footerText, sectionTitle } from "./layout";
import { formatMoney } from "./money";
import { singleLine } from "./sanitize";
import { addressHtml, addressText, itemsHtml, itemsText } from "./order-templates";
import type { Rendered } from "./templates";
import type { EmailData, PaymentAlertData } from "./types";

/**
 * The e-mails to the shop owner. They are working messages: short, with the ids needed to act and
 * the exact next step. Nothing here ever carries card data or a secret (the shop has none: Razorpay
 * keeps them); a payment is identified by its Razorpay ids only. Reply-To is not set (nobody reads
 * replies to a notification).
 */

const REASON = "This is an automatic message to the shop owner address (Admin > Contact Page, else SUPER_ADMIN_EMAIL).";
const line = (v: string | undefined, max: number) => singleLine(v ?? "", max);

function wrap(i: { subject: string; heading: string; preheader: string; bodyHtml: string }, text: string): Rendered {
  const siteUrl = getSiteUrl();
  return {
    senderName: SENDER_NAMES.site,
    subject: singleLine(i.subject, 150),
    html: layout({ title: i.subject, preheader: i.preheader, heading: i.heading, bodyHtml: i.bodyHtml, shop: {}, siteUrl, reason: REASON }),
    text: `${text}\n\n--\n${footerText({ shop: {}, siteUrl, reason: REASON })}`,
  };
}

const detailRows = (rows: [string, string | undefined][]) => {
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  return {
    html: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">${shown
      .map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;font-size:13px;color:${COLORS.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:3px 0;font-size:13px;color:${COLORS.ink};word-break:break-all;">${esc(v)}</td></tr>`)
      .join("")}</table>`,
    text: shown.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
};

const steps = (items: string[]) => ({
  html: `${sectionTitle("What to do next")}<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${items.map((s) => `<li style="margin-bottom:4px;">${esc(s)}</li>`).join("")}</ol>`,
  text: `What to do next\n${items.map((s, n) => `${n + 1}. ${s}`).join("\n")}`,
});

// ─── 1. new order ───────────────────────────────────────────────────────────

export function renderOwnerNewOrder(d: EmailData["owner-new-order"]): Rendered {
  const num = orderNumber(d.orderId);
  const name = line(d.customerName, 80);
  const placed = formatShopDate(d.placedAt, "dateTime", { withZone: true });
  const link = `${getSiteUrl()}/admin/orders?order=${encodeURIComponent(d.orderId)}`;
  const intro = `New paid order ${num} from ${name}, ${formatMoney(d.total)}, placed ${placed}.`;
  const bodyHtml = paragraph(intro) + noticeBox(`Customer: <strong>${esc(name)}</strong>`) + itemsHtml(d) + addressHtml(d) + `<p style="margin:20px 0 4px;"></p>` + button(link, "Open this order in the admin");
  const text = [intro, `Customer: ${name}`, itemsText(d), addressText(d), `Open this order in the admin: ${link}`].join("\n\n");
  return wrap({ subject: `New order ${num}: ${formatMoney(d.total)} from ${name}`, heading: "New order", preheader: intro, bodyHtml }, text);
}

// ─── 2. payment problems (URGENT) ───────────────────────────────────────────

const ALERT: Record<PaymentAlertData["kind"], { headline: (num: string) => string; what: (d: PaymentAlertData, num: string) => string }> = {
  "payment-without-order": {
    headline: () => "Payment received but no order was created",
    what: () => "Razorpay confirmed a payment, but the shop could not create an order for it (the checkout session was gone). The customer has paid and has nothing to show for it.",
  },
  "duplicate-payment": {
    headline: () => "The same payment is recorded on two orders",
    what: (d, num) => `The payment below is attached to more than one order (latest: ${num}). The customer paid once.`,
  },
  "refund-due": {
    headline: (num) => `Refund to make for cancelled order ${num}`,
    what: (d, num) => `Order ${num} was cancelled after it was paid. The money is NOT returned automatically: you must refund it in Razorpay.`,
  },
  "order-in-review": {
    headline: (num) => `Order ${num} needs review before you ship it`,
    what: (d, num) => `The shop flagged order ${num}. The customer has paid, so the order stands, but check the note below before shipping.`,
  },
};

function alertSteps(d: PaymentAlertData, num: string, adminLink: string): string[] {
  const pay = d.razorpayPaymentId;
  switch (d.kind) {
    case "payment-without-order":
      return [
        `Open the Razorpay Dashboard > Transactions > Payments and search for ${pay}. Check the amount and who paid.`,
        "Decide: either refund the payment in Razorpay, or create and ship the order by hand and tell the customer.",
        'Then open Admin > Dashboard, find this payment under "payments received without an order" and press "Mark resolved".',
      ];
    case "duplicate-payment":
      return [
        `Open the orders in the admin (${adminLink}) and find the other order with payment ${pay}.`,
        "Ship only ONE of the orders and cancel the other. No refund is needed for the cancelled one (the customer paid once): in its Refund box choose \"Not needed\".",
      ];
    case "refund-due":
      return [
        `Open the Razorpay Dashboard > Transactions > Payments, find ${pay} and press Refund${d.amount ? ` for ${formatMoney(d.amount)}` : ""}.`,
        `Then open the order in the admin (${adminLink}), set its Refund status to Refunded and paste the Razorpay refund id. The customer is e-mailed automatically when you do.`,
      ];
    case "order-in-review":
      return [
        "Read the note below (it is also shown on the order in the admin).",
        `Check payment ${pay} in the Razorpay Dashboard if the note mentions an amount or a duplicate.`,
        `Fix it (refund the difference, contact the customer, or check the stock) before you ship: ${adminLink}`,
      ];
  }
}

export function renderOwnerPaymentAlert(d: EmailData["owner-payment-alert"]): Rendered {
  const num = d.orderId ? orderNumber(d.orderId) : "";
  const adminLink = d.orderId ? `${getSiteUrl()}/admin/orders?order=${encodeURIComponent(d.orderId)}` : `${getSiteUrl()}/admin`;
  const a = ALERT[d.kind];
  const headline = a.headline(num);
  const what = a.what(d, num);
  const rows = detailRows([
    ["Razorpay payment id", line(d.razorpayPaymentId, 64)],
    ["Razorpay order id", line(d.razorpayOrderId, 64)],
    ["Amount", d.amount !== undefined ? formatMoney(d.amount) : undefined],
    ["Shop order", num || undefined],
  ]);
  const s = steps(alertSteps(d, num, adminLink));
  const note = d.note ? line(d.note, 1500) : "";
  const bodyHtml =
    paragraph(`URGENT: ${what}`, "font-weight:600;") + rows.html +
    (note ? noticeBox(`<strong>Note on the order:</strong> ${esc(note)}`) : "") +
    s.html + button(adminLink, d.orderId ? "Open this order in the admin" : "Open the admin dashboard");
  const text = [`URGENT: ${what}`, rows.text, note && `Note on the order: ${note}`, s.text, `${d.orderId ? "Open this order in the admin" : "Open the admin dashboard"}: ${adminLink}`].filter(Boolean).join("\n\n");
  return wrap({ subject: `URGENT: ${headline}`, heading: headline, preheader: `URGENT: ${headline}. Payment ${d.razorpayPaymentId}.`, bodyHtml }, text);
}

// ─── 4. failed e-mails ──────────────────────────────────────────────────────

export function renderOwnerFailedSummary(d: EmailData["owner-failed-summary"]): Rendered {
  const link = `${getSiteUrl()}/admin`;
  const intro = `${d.total} e-mail${d.total === 1 ? "" : "s"} could not be delivered and will not be retried any more.`;
  const list = d.byType.map((g) => `${emailTypeLabel(g.type)}: ${g.count}`);
  const s = steps([
    'Open Admin > Dashboard, "E-mails that failed", and press Resend on the ones you want to send again (the customer\'s order e-mails can be resent; sign-in codes cannot).',
    "If many failed, check the mail service: the SMTP login and key, the sender address, the domain authentication, and the daily sending limit (Brevo free plan: 300 a day).",
  ]);
  const bodyHtml = paragraph(intro) + `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` + s.html + button(link, "Open the admin dashboard");
  const text = [intro, list.map((l) => `- ${l}`).join("\n"), s.text, `Open the admin dashboard: ${link}`].join("\n\n");
  return wrap({ subject: `Warning: ${d.total} e-mail${d.total === 1 ? "" : "s"} could not be delivered`, heading: "E-mails could not be delivered", preheader: intro, bodyHtml }, text);
}

// ─── 6. low stock ───────────────────────────────────────────────────────────

export function renderOwnerLowStock(d: EmailData["owner-low-stock"]): Rendered {
  const name = line(d.name, 150);
  const link = `${getSiteUrl()}/admin/products`;
  const intro = d.left <= 0 ? `${name} is sold out.` : `${name} is down to ${d.left} in stock (your low-stock level is ${d.threshold}).`;
  const next = "Restock it in Admin > Products when you can. You are told once per drop: you will be e-mailed again only after the stock has gone back above the level and fallen to it again.";
  const bodyHtml = paragraph(intro) + paragraph(next) + button(link, "Open Products in the admin");
  const text = [intro, next, `Open Products in the admin: ${link}`].join("\n\n");
  return wrap({ subject: d.left <= 0 ? `Sold out: ${name}` : `Low stock: ${name} (${d.left} left)`, heading: d.left <= 0 ? "Sold out" : "Low stock", preheader: intro, bodyHtml }, text);
}

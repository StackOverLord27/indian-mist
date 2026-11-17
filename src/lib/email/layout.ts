import { escapeHtml, singleLine } from "./sanitize";
import type { ShopInfo } from "./types";

/**
 * The shared look of every customer e-mail: one table-based layout, 600 px wide (narrower on a
 * phone), inline styles only (mail programs ignore style sheets), the same colours and wordmark as
 * the sign-up code e-mail, and one footer with how to reach the shop. Every value that comes from
 * a customer, an admin or the database goes through `escapeHtml`; the text part has its own twin of
 * each helper because it is plain text, not escaped HTML.
 */
export const COLORS = {
  page: "#f7f3e8",
  card: "#ffffff",
  ink: "#3b4a2f",
  accent: "#4a5e35",
  muted: "#7a7a6a",
  line: "#e8dfc8",
  soft: "#fdfaf4",
  warn: "#7a3b2e",
} as const;

const FONT = "'Helvetica Neue',Arial,sans-serif";
const SERIF = "'Georgia',serif";

export const esc = escapeHtml;

/** An http(s) address (normalised), or null: anything else (javascript:, data:, junk) is never made a link. */
export function safeHttpUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const paragraph = (text: string, style = "") =>
  `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${COLORS.ink};${style}">${esc(text)}</p>`;

/** A call-to-action link as a table cell (works in Outlook, where padded links do not). */
export function button(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 20px;"><tr><td style="background:${COLORS.accent};border-radius:6px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

/** A shaded box for a notice (refund wording, tracking details). `html` is already escaped. */
export const noticeBox = (html: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;background:${COLORS.soft};border:1px solid ${COLORS.line};border-radius:8px;"><tr><td style="padding:14px 18px;font-size:13px;line-height:1.7;color:${COLORS.ink};">${html}</td></tr></table>`;

export const sectionTitle = (text: string) =>
  `<p style="margin:24px 0 8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.muted};">${esc(text)}</p>`;

/** How to reach the shop, as HTML lines and as text lines (empty when the shop has saved nothing). */
export function contactLines(shop: ShopInfo): { html: string[]; text: string[] } {
  const html: string[] = [];
  const text: string[] = [];
  const email = singleLine(shop.email ?? "", 120);
  const phone = singleLine(shop.phone ?? "", 40);
  const hours = singleLine(shop.hours ?? "", 200);
  if (email) {
    html.push(`E-mail: <a href="mailto:${esc(email)}" style="color:${COLORS.accent};">${esc(email)}</a>`);
    text.push(`E-mail: ${email}`);
  }
  if (phone) {
    html.push(`Phone: ${esc(phone)}`);
    text.push(`Phone: ${phone}`);
  }
  if (hours) {
    html.push(`Hours: ${esc(hours)}`);
    text.push(`Hours: ${hours}`);
  }
  return { html, text };
}

/** "Questions? ..." sentence for the body, in both forms. Falls back to replying to the e-mail. */
export function helpLine(shop: ShopInfo): { html: string; text: string } {
  const c = contactLines(shop);
  if (!c.html.length) {
    const t = "Questions about your order? Just reply to this e-mail.";
    return { html: paragraph(t), text: t };
  }
  return {
    html: `<p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:${COLORS.ink};">Questions about your order? You can reach us here:</p><p style="margin:0 0 16px;font-size:13px;line-height:1.8;color:${COLORS.ink};">${c.html.join("<br/>")}</p>`,
    text: `Questions about your order? You can reach us here:\n${c.text.join("\n")}`,
  };
}

export type LayoutInput = {
  /** The e-mail's <title> and the short preview shown next to the subject in the inbox */
  title: string;
  preheader: string;
  heading: string;
  /** Already-escaped HTML for the card */
  bodyHtml: string;
  shop: ShopInfo;
  siteUrl: string;
  /** Why this e-mail was sent, one sentence ("You are receiving this e-mail because ...") */
  reason: string;
};

/** Privacy and Terms always; Refund and Shipping only when those pages exist (so no link ever points to an empty or missing page) */
function policyLinks(i: Pick<LayoutInput, "shop" | "siteUrl">): [string, string][] {
  const has = (slug: "refund-policy" | "shipping-policy") => !!i.shop.policies?.includes(slug);
  return [
    ["Privacy Policy", `${i.siteUrl}/privacy-policy`],
    ["Terms & Conditions", `${i.siteUrl}/terms-and-conditions`],
    ...(has("refund-policy") ? [["Refund & Cancellation Policy", `${i.siteUrl}/refund-policy`] as [string, string]] : []),
    ...(has("shipping-policy") ? [["Shipping & Delivery Policy", `${i.siteUrl}/shipping-policy`] as [string, string]] : []),
  ];
}

export function footerHtml(i: Pick<LayoutInput, "shop" | "siteUrl" | "reason">): string {
  const c = contactLines(i.shop);
  const links = policyLinks(i)
    .map(([label, href]) => `<a href="${esc(href)}" style="color:${COLORS.accent};text-decoration:none;">${esc(label)}</a>`)
    .join("&nbsp;&middot;&nbsp;");
  return `${c.html.length ? `${c.html.join("<br/>")}<br/>` : ""}${links}<br/>${esc(i.reason)}<br/>&copy; ${new Date().getFullYear()} Indian Mist`;
}

export function footerText(i: Pick<LayoutInput, "shop" | "siteUrl" | "reason">): string {
  const c = contactLines(i.shop);
  return [
    ...c.text,
    ...policyLinks(i).map(([label, href]) => `${label}: ${href}`),
    i.reason,
    `© ${new Date().getFullYear()} Indian Mist`,
  ].join("\n");
}

export function layout(i: LayoutInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${esc(i.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.page};">${esc(i.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${COLORS.page};padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding-bottom:20px;font-family:${SERIF};font-size:22px;letter-spacing:1px;color:${COLORS.ink};">Indian Mist</td>
          </tr>
          <tr>
            <td style="background:${COLORS.card};border-radius:12px;border-top:4px solid ${COLORS.accent};padding:32px 32px 20px;">
              <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:24px;font-weight:normal;color:${COLORS.ink};">${esc(i.heading)}</h1>
              ${i.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 8px;font-size:11px;line-height:1.8;color:#9e9e8e;">${footerHtml(i)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

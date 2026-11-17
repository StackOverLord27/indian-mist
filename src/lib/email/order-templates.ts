import { getSiteUrl } from "@/lib/env";
import { orderNumber } from "@/lib/order-number";
import { formatShopDate } from "@/lib/shop-time";
import { SENDER_NAMES } from "./config";
import { COLORS, button, esc, helpLine, layout, noticeBox, paragraph, safeHttpUrl, sectionTitle, footerText } from "./layout";
import { formatMoney } from "./money";
import { SAFE_ADDRESS, singleLine } from "./sanitize";
import type { Rendered } from "./templates";
import type { EmailData, OrderMailData, ShopInfo } from "./types";

/**
 * The customer's order e-mails and the password notice. Each one is a small function that returns
 * the subject, the HTML (inside the shared 600 px layout) and a plain-text twin. Nothing here
 * promises an invoice or a delivery date: the shop has neither. Refund wording never states a date.
 */

const first = (name: string) => singleLine(name, 80).split(" ")[0] || "there";
const line = (value: string | undefined, max: number) => singleLine(value ?? "", max);

const ORDERS_PATH = "/profile"; // "My Orders" is the order history on the profile page

function replyToOf(shop: ShopInfo): string | undefined {
  const address = line(shop.email, 120);
  return address && SAFE_ADDRESS.test(address) ? address : undefined;
}

function withLayout(d: { shop: ShopInfo }, i: { subject: string; heading: string; preheader: string; bodyHtml: string; reason: string }, text: string): Rendered {
  const siteUrl = getSiteUrl();
  const html = layout({ title: i.subject, preheader: i.preheader, heading: i.heading, bodyHtml: i.bodyHtml, shop: d.shop, siteUrl, reason: i.reason });
  return {
    senderName: SENDER_NAMES.site,
    subject: singleLine(i.subject, 150),
    html,
    text: `${text}\n\n--\n${footerText({ shop: d.shop, siteUrl, reason: i.reason })}`,
    replyTo: replyToOf(d.shop),
  };
}

// ─── Pieces of an order ─────────────────────────────────────────────────────

function itemsHtml(d: OrderMailData): string {
  const rows = d.lines.map((l) => {
    // each part is escaped on its own; only the separator is markup
    const details = [l.size && esc(`Size: ${line(l.size, 40)}`), l.color && esc(`Colour: ${line(l.color, 40)}`), esc(`Qty ${l.quantity} × ${formatMoney(l.price)}`)].filter(Boolean).join(" &middot; ");
    return `<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;line-height:1.5;color:${COLORS.ink};">${esc(line(l.name, 150))}<br/><span style="font-size:12px;color:${COLORS.muted};">${details}</span></td><td align="right" valign="top" style="padding:10px 0 10px 12px;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.ink};white-space:nowrap;">${formatMoney(l.price * l.quantity)}</td></tr>`;
  });
  const total = (label: string, value: string, strong = false, color: string = COLORS.muted) =>
    `<tr><td style="padding:4px 0;font-size:${strong ? 15 : 13}px;${strong ? "font-weight:700;" : ""}color:${strong ? COLORS.ink : color};">${esc(label)}</td><td align="right" style="padding:4px 0;font-size:${strong ? 15 : 13}px;${strong ? "font-weight:700;" : ""}color:${strong ? COLORS.ink : color};white-space:nowrap;">${value}</td></tr>`;
  const totals = [
    total("Subtotal", formatMoney(d.subtotal)),
    total("Shipping", d.shipping > 0 ? formatMoney(d.shipping) : "Free"),
    d.discount > 0 ? total(`Discount${d.promoCode ? ` (${line(d.promoCode, 40)})` : ""}`, `-${formatMoney(d.discount)}`) : "",
    d.tax > 0 ? total("Taxes", formatMoney(d.tax)) : "",
    total("Total", formatMoney(d.total), true),
  ].join("");
  return `${sectionTitle("Your items")}<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows.join("")}</table><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px;">${totals}</table>`;
}

function itemsText(d: OrderMailData): string {
  const items = d.lines.map((l) => {
    const opts = [l.size && `size ${line(l.size, 40)}`, l.color && line(l.color, 40)].filter(Boolean).join(", ");
    return `- ${line(l.name, 150)}${opts ? ` (${opts})` : ""}, qty ${l.quantity} x ${formatMoney(l.price)} = ${formatMoney(l.price * l.quantity)}`;
  });
  return [
    "Your items",
    ...items,
    "",
    `Subtotal: ${formatMoney(d.subtotal)}`,
    `Shipping: ${d.shipping > 0 ? formatMoney(d.shipping) : "Free"}`,
    ...(d.discount > 0 ? [`Discount${d.promoCode ? ` (${line(d.promoCode, 40)})` : ""}: -${formatMoney(d.discount)}`] : []),
    ...(d.tax > 0 ? [`Taxes: ${formatMoney(d.tax)}`] : []),
    `Total: ${formatMoney(d.total)}`,
  ].join("\n");
}

function addressLines(d: OrderMailData): string[] {
  const a = d.address;
  return [line(d.customerName, 80), line(a.street, 160), `${line(a.city, 80)}, ${line(a.state, 80)} ${line(a.zipCode, 20)}`, line(a.country, 80)].filter((l) => l.trim() !== "" && l.trim() !== ",");
}
const addressHtml = (d: OrderMailData) =>
  `${sectionTitle("Delivery address")}<p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${addressLines(d).map(esc).join("<br/>")}</p>`;
const addressText = (d: OrderMailData) => `Delivery address\n${addressLines(d).join("\n")}`;

const ordersButton = () => button(`${getSiteUrl()}${ORDERS_PATH}`, "View My Orders");
const ordersLinkText = () => `View your orders: ${getSiteUrl()}${ORDERS_PATH}`;

const reasonOrder = "You are receiving this e-mail because of an order on your Indian Mist account.";

function tracking(d: OrderMailData): { html: string; text: string } | null {
  const courier = line(d.courier, 80);
  const number = line(d.trackingNumber, 80);
  const url = safeHttpUrl(d.trackingUrl);
  if (!courier && !number && !url) return null;
  const rows: string[] = [];
  const text: string[] = ["Tracking"];
  if (courier) { rows.push(`Courier: <strong>${esc(courier)}</strong>`); text.push(`Courier: ${courier}`); }
  if (number) { rows.push(`Tracking number: <strong>${esc(number)}</strong>`); text.push(`Tracking number: ${number}`); }
  if (url) { rows.push(`Track your parcel: <a href="${esc(url)}" style="color:${COLORS.accent};">${esc(url)}</a>`); text.push(`Track your parcel: ${url}`); }
  return { html: noticeBox(rows.join("<br/>")), text: text.join("\n") };
}

// ─── The e-mails ────────────────────────────────────────────────────────────

export function renderOrderConfirmation(d: OrderMailData): Rendered {
  const num = orderNumber(d.orderId);
  const placed = formatShopDate(d.placedAt, "dateTime", { withZone: true });
  const help = helpLine(d.shop);
  const intro = `Hi ${first(d.customerName)}, thank you for your order. We have received your payment and your order is confirmed.`;
  const meta = `Order number: ${num}\nPlaced on: ${placed}`;
  const next = "We will e-mail you again when your order ships.";
  const bodyHtml =
    paragraph(intro) +
    noticeBox(`Order number: <strong>${esc(num)}</strong><br/>Placed on: ${esc(placed)}`) +
    itemsHtml(d) + addressHtml(d) +
    `<p style="margin:20px 0 4px;"></p>` + paragraph(next) + ordersButton() + help.html;
  const text = [intro, meta, itemsText(d), addressText(d), next, ordersLinkText(), help.text].join("\n\n");
  return withLayout(d, { subject: `Order confirmed: ${num}`, heading: "Thank you for your order", preheader: `Your order ${num} is confirmed.`, bodyHtml, reason: reasonOrder }, text);
}

export function renderOrderShipped(d: OrderMailData): Rendered {
  const num = orderNumber(d.orderId);
  const help = helpLine(d.shop);
  const t = tracking(d);
  const intro = `Hi ${first(d.customerName)}, your order ${num} has been shipped.`;
  const bodyHtml = paragraph(intro) + (t?.html ?? "") + itemsHtml(d) + addressHtml(d) + ordersButton() + help.html;
  const text = [intro, t?.text, itemsText(d), addressText(d), ordersLinkText(), help.text].filter(Boolean).join("\n\n");
  return withLayout(d, { subject: `Your order ${num} has shipped`, heading: "Your order is on its way", preheader: `Order ${num} has been shipped.`, bodyHtml, reason: reasonOrder }, text);
}

/** What the customer is told about their money after a cancellation. Never a date. */
export function cancellationRefundWording(d: Pick<OrderMailData, "paymentStatus" | "refundStatus" | "total">): string {
  if (d.paymentStatus !== "PAID") return "You were not charged for this order, so no refund is due.";
  if (d.refundStatus === "REFUNDED") return `Your payment of ${formatMoney(d.total)} has been refunded to your original payment method. Refunds made through Razorpay usually take several working days to reach your account.`;
  if (d.refundStatus === "NOT_NEEDED") return "No refund is due for this order.";
  return `A refund of ${formatMoney(d.total)} is due to you. We will return it to your original payment method and e-mail you again once it has been issued. Refunds made through Razorpay usually take several working days to reach your account after they are issued.`;
}

export function renderOrderCancelled(d: OrderMailData): Rendered {
  const num = orderNumber(d.orderId);
  const help = helpLine(d.shop);
  const intro = `Hi ${first(d.customerName)}, your order ${num} has been cancelled.`;
  const refund = cancellationRefundWording(d);
  const bodyHtml = paragraph(intro) + noticeBox(esc(refund)) + itemsHtml(d) + ordersButton() + help.html;
  const text = [intro, refund, itemsText(d), ordersLinkText(), help.text].join("\n\n");
  return withLayout(d, { subject: `Your order ${num} has been cancelled`, heading: "Your order was cancelled", preheader: `Order ${num} has been cancelled.`, bodyHtml, reason: reasonOrder }, text);
}

export function renderOrderRefunded(d: OrderMailData): Rendered {
  const num = orderNumber(d.orderId);
  const help = helpLine(d.shop);
  const amount = d.orderStatus === "CANCELLED" ? ` of ${formatMoney(d.total)}` : "";
  const intro = `Hi ${first(d.customerName)}, we have issued the refund${amount} for your order ${num}.`;
  const when = "Razorpay refunds usually take several working days to reach your account. The exact time depends on your bank or card issuer.";
  const bodyHtml = paragraph(intro) + noticeBox(esc(when)) + ordersButton() + help.html;
  const text = [intro, when, ordersLinkText(), help.text].join("\n\n");
  return withLayout(d, { subject: `Refund issued for order ${num}`, heading: "Your refund has been issued", preheader: `The refund for order ${num} has been issued.`, bodyHtml, reason: reasonOrder }, text);
}

export function renderOrderDelivered(d: OrderMailData): Rendered {
  const num = orderNumber(d.orderId);
  const help = helpLine(d.shop);
  const intro = `Hi ${first(d.customerName)}, your order ${num} has been marked as delivered. We hope you enjoy it.`;
  const bodyHtml = paragraph(intro) + itemsHtml(d) + ordersButton() + help.html;
  const text = [intro, itemsText(d), ordersLinkText(), help.text].join("\n\n");
  return withLayout(d, { subject: `Your order ${num} has been delivered`, heading: "Your order was delivered", preheader: `Order ${num} has been delivered.`, bodyHtml, reason: reasonOrder }, text);
}

/** A short notice after a password reset. No sign-in link: a link in a security notice is what phishing copies. */
export function renderPasswordChanged(d: EmailData["password-changed"]): Rendered {
  const when = formatShopDate(d.changedAt, "dateTime", { withZone: true });
  const email = line(d.shop.email, 120);
  const reach = email ? `contact us straight away at ${email}` : "reply to this e-mail straight away";
  const intro = `Hi ${first(d.name)}, the password of your Indian Mist account was changed on ${when}.`;
  const ok = "If this was you, there is nothing more to do. Any other device that was signed in has been signed out.";
  const warn = `If this was not you, ${reach}.`;
  const bodyHtml = paragraph(intro) + paragraph(ok) +
    noticeBox(`If this was <strong>not</strong> you, ${email ? `contact us straight away at <a href="mailto:${esc(email)}" style="color:${COLORS.accent};">${esc(email)}</a>` : "reply to this e-mail straight away"}.`);
  const text = [intro, ok, warn].join("\n\n");
  return withLayout(d, { subject: "Your Indian Mist password was changed", heading: "Your password was changed", preheader: "The password of your account was changed.", bodyHtml, reason: "You are receiving this e-mail because of a security change on your Indian Mist account." }, text);
}

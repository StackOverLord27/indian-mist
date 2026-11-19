/**
 * The shop's clock. The shop sells in India, so every date and time an admin types or reads, and
 * every date a customer sees, is in INDIA TIME (Asia/Kolkata, "IST", UTC+05:30, no daylight
 * saving), whatever the time zone of the browser or of the server (Vercel runs in UTC).
 *
 * Why not "the browser's time zone": a promo that "ends at 11:59 PM on 15 November" is a business
 * time, not a point on the admin's laptop clock. With the browser's zone the same saved instant
 * would read differently on a laptop abroad or behind a VPN, and a server-rendered date (UTC on
 * Vercel) could show the wrong day to a customer in India between midnight and 05:30.
 *
 * Everything stored is a UTC instant (an ISO string in the API, a Date in MongoDB). Only the
 * conversion to and from what a person types or reads lives here. Pure functions, no dependencies.
 */
export const SHOP_TIME_ZONE = "Asia/Kolkata";
export const SHOP_TIME_LABEL = "IST";

type Instant = string | number | Date | null | undefined;

const toDate = (value: Instant): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** The shop-time calendar parts of an instant. */
function shopParts(date: Date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

/** How many ms the shop clock is ahead of UTC at this instant (19 800 000 for IST). */
function shopOffsetMs(date: Date): number {
  const p = shopParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** An instant as the value of a datetime-local input: "YYYY-MM-DDTHH:mm" in shop time, or "" when empty or invalid. */
export function toShopInputValue(value: Instant): string {
  const d = toDate(value);
  if (!d) return "";
  const p = shopParts(d);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * What was typed into a datetime-local input (shop time) as a UTC instant (ISO string), or null
 * when it is empty or not a real date and time. Built from the typed parts, never from `new
 * Date("...")` (which reads the string in the browser's own zone).
 */
export function fromShopInputValue(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec((value ?? "").trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second); // the typed numbers, read as if they were UTC
  const check = new Date(wall);
  // reject 31 February, 25:00 and the like (Date.UTC would silently roll them over)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  // The instant is the typed wall time minus the shop's offset. The offset is looked up at the
  // guess and once more at the result (matters only for zones with daylight saving; India has none).
  let instant = wall - shopOffsetMs(new Date(wall));
  instant = wall - shopOffsetMs(new Date(instant));
  return new Date(instant).toISOString();
}

type Style = "date" | "dateLong" | "dateTime";
const styles: Record<Style, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  dateLong: { day: "numeric", month: "long", year: "numeric" },
  dateTime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
};

/** A date for display, in shop time, the same on the server and in every browser. */
export function formatShopDate(value: Instant, style: Style = "date", opts: { withZone?: boolean } = {}): string {
  const d = toDate(value);
  if (!d) return "";
  const text = new Intl.DateTimeFormat("en-IN", { ...styles[style], timeZone: SHOP_TIME_ZONE }).format(d);
  return opts.withZone ? `${text} ${SHOP_TIME_LABEL}` : text;
}

/**
 * Has an "expires at" instant been reached? The exact instant, no rounding to a minute, hour or
 * day: from the moment of expiry onwards (<=) it counts as expired. No expiry (null) never expires.
 */
export function hasExpired(expiresAt: Instant, now: Date | number = new Date()): boolean {
  const d = toDate(expiresAt);
  if (!d) return false;
  return d.getTime() <= (typeof now === "number" ? now : now.getTime());
}

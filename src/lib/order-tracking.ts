import { z } from "zod";
import { safeHttpUrl } from "@/lib/email/layout";
import { singleLine } from "@/lib/email/sanitize";

/**
 * Optional shipping details the admin can add to an order (courier, tracking number, tracking
 * link). They are NEVER a reason to refuse or roll back a status change: a field that is not valid
 * is left out and reported back, the status change goes ahead. An empty text clears a saved value;
 * a field that is not mentioned is left as it is.
 */
export const TRACKING_FIELDS = ["courier", "trackingNumber", "trackingUrl"] as const;
export type TrackingField = (typeof TRACKING_FIELDS)[number];

const text = (max: number) => z.string().transform((v) => singleLine(v, max + 1)).pipe(z.string().max(max));
const SCHEMAS: Record<TrackingField, z.ZodType<string>> = {
  courier: text(80),
  trackingNumber: text(80),
  // an http(s) link only: never javascript:, data: or junk (it becomes a link in an e-mail)
  trackingUrl: z.string().trim().max(500).transform((v, ctx) => {
    if (v === "") return "";
    const url = safeHttpUrl(v);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "not an http(s) link" });
      return z.NEVER;
    }
    return url;
  }),
};

export type ParsedTracking = { set: Partial<Record<TrackingField, string>>; unset: TrackingField[]; ignored: TrackingField[] };

export function parseTracking(body: Record<string, unknown>): ParsedTracking {
  const out: ParsedTracking = { set: {}, unset: [], ignored: [] };
  for (const field of TRACKING_FIELDS) {
    const raw = body[field];
    if (raw === undefined || raw === null) continue;
    const parsed = typeof raw === "string" ? SCHEMAS[field].safeParse(raw) : null;
    if (!parsed?.success) out.ignored.push(field);
    else if (parsed.data === "") out.unset.push(field);
    else out.set[field] = parsed.data;
  }
  return out;
}

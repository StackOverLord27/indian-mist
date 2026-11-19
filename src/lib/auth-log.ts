/**
 * One log format for "why was this customer not signed in": `[auth] <event> key=value ...`.
 * Safe for the edge runtime (console only). Callers pass ONLY non-personal values: a reason, a
 * path, a number of seconds. Never a token, an e-mail address, a user or session id.
 */
export type AuthLogValue = string | number | boolean;

const clean = (v: AuthLogValue) => String(v).replace(/[\u0000-\u001f\u007f\s]+/g, "_").slice(0, 80);

export function logAuth(event: string, details: Record<string, AuthLogValue> = {}): void {
  const parts = Object.entries(details).map(([k, v]) => `${k}=${clean(v)}`);
  console.warn(`[auth] ${event}${parts.length ? " " + parts.join(" ") : ""}`);
}

/** Age in whole seconds of a JWT from its `iat` claim, or "unknown". Used in log lines only. */
export function tokenAgeSeconds(iat: unknown, nowMs: number = Date.now()): number | "unknown" {
  return typeof iat === "number" ? Math.max(0, Math.round(nowMs / 1000 - iat)) : "unknown";
}

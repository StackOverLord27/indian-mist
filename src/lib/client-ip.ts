import type { NextRequest } from "next/server";

/** The caller's address, preferring headers the hosting platform sets (x-forwarded-for can be faked). */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

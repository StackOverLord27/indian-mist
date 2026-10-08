"use client";

import { z } from "zod";

// Zod probes whether the browser allows eval() to speed up validation. The site's content
// security policy forbids eval, so turn that attempt off instead of triggering a violation report.
z.config({ jitless: true });

export function ClientSetup() {
  return null;
}

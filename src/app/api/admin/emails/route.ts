export const runtime = "nodejs";

import { after } from "next/server";
import { withAdmin, successResponse } from "@/lib/api-helpers";
import { listFailedEmails } from "@/lib/email/admin";
import { sweepThrottled } from "@/lib/email/sweep";

/** Failed e-mails of the last 7 days (no addresses, no bodies) and the count that needs attention. */
export const GET = withAdmin(async () => {
  after(() => sweepThrottled()); // opening the dashboard also retries what is due (once a minute at most)
  return successResponse(await listFailedEmails());
});

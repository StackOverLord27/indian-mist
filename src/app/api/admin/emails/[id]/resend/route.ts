export const runtime = "nodejs";
export const maxDuration = 60;

import mongoose from "mongoose";
import { withAdmin, successResponse, errorResponse } from "@/lib/api-helpers";
import { resendEmail } from "@/lib/email/admin";

/** Sends one failed e-mail again, now. The result (sent or failed again) shows in the list. */
export const POST = withAdmin(async (_req, context) => {
  const { id } = await context.params;
  if (!id || !mongoose.isValidObjectId(id)) return errorResponse("Invalid e-mail ID", 400);
  const result = await resendEmail(id);
  if (result === "not-found") return errorResponse("E-mail not found", 404);
  if (result === "not-resendable") return errorResponse("This kind of e-mail cannot be sent again from here (sign-in codes and contact messages are not stored).", 400);
  if (result === "not-failed") return errorResponse("This e-mail is not waiting to be resent.", 409);
  return successResponse({ message: "Sent again. Refresh to see the result." });
});

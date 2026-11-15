/**
 * Server-side sign-in sessions: one RefreshToken row per session token, rows of one sign-in share
 * a `family`. The refresh token does NOT rotate: its value and cookie stay the same for the whole
 * session, a renewal only hands out a new access token and pushes the sliding expiry out.
 * (Node only: imports models. The edge proxy must not import this file.)
 */
import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { RefreshToken } from "@/models/refreshToken.model";
import { roleForEmail } from "@/lib/roles";
import {
  MAX_SESSIONS_PER_USER,
  hashToken,
  refreshLifetimeFor,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth-tokens";

/** Sliding expiry from `now`, never past the absolute maximum. */
export function slidingExpiry(now: number, slidingSec: number, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now + slidingSec * 1000, absoluteExpiresAt.getTime()));
}

/** Ends the oldest sessions of an account beyond MAX_SESSIONS_PER_USER (newest = latest sign-in). */
export async function pruneSessions(userId: Types.ObjectId | string): Promise<number> {
  const families = await RefreshToken.aggregate<{ _id: string }>([
    { $match: { userId: new Types.ObjectId(String(userId)) } },
    { $group: { _id: "$family", newest: { $max: "$_id" } } },
    { $sort: { newest: -1 } },
    { $skip: MAX_SESSIONS_PER_USER },
  ]);
  if (families.length === 0) return 0;
  const res = await RefreshToken.deleteMany({
    userId: new Types.ObjectId(String(userId)),
    family: { $in: families.map((f) => f._id) },
  });
  return res.deletedCount ?? 0;
}

/** Creates a new sign-in session for the user and returns the tokens to put in cookies. */
export async function startSession(user: { _id: Types.ObjectId | string; email: string }) {
  const role = roleForEmail(user.email);
  const life = refreshLifetimeFor(role);
  const userId = String(user._id);
  const family = randomUUID();
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + life.absolute * 1000);

  const accessToken = signAccessToken({ userId, email: user.email, role });
  const refreshToken = signRefreshToken({ userId, family }, life.absolute);

  // Persist only the hash — never store the raw refresh token in the DB.
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: slidingExpiry(now, life.sliding, absoluteExpiresAt),
    absoluteExpiresAt,
  });
  // Best effort: a failure here must not fail the sign-in (the next sign-in prunes again)
  await pruneSessions(user._id).catch((e) => console.error("[auth] pruning old sessions failed:", e instanceof Error ? e.message : "error"));

  return { role, accessToken, refreshToken, refreshMaxAge: life.sliding };
}

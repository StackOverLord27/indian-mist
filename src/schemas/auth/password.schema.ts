import { z } from "zod";

// bcrypt only uses the first 72 bytes of a password, so longer ones would silently be cut short.
export const MAX_PASSWORD_BYTES = 72;

/** The password rules for new passwords (sign-up and password reset). Sign-in stays lenient. */
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(MAX_PASSWORD_BYTES, "Password is too long")
  .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

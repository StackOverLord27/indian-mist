import { z } from "zod";
import { PasswordSchema } from "./password.schema";

export const RequestOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
  newPassword: PasswordSchema,
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});

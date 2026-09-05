import { z } from "zod";

export const RequestOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters long"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});

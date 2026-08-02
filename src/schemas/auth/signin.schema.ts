import { z } from "zod";

export const SignInSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),
  // We do not enforce strong password rules on sign-in, just that it is provided.
  // This ensures users who created accounts before stricter rules were added can still log in.
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof SignInSchema>;

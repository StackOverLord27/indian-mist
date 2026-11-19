import { z } from "zod";
import { PasswordSchema } from "./password.schema";

export const SignUpSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),
  password: PasswordSchema,
});

// Infer the TypeScript type from the schema so it can be used elsewhere if needed
export type SignUpInput = z.infer<typeof SignUpSchema>;

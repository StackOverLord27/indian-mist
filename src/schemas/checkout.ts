import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().min(1, "Please enter your full name"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  street: z.string().min(1, "Please enter your street address"),
  city: z.string().min(1, "Please enter your city"),
  state: z.string().min(1, "Please enter your state"),
  zipCode: z.string().min(6, "Please enter a valid PIN code"),
  saveAddress: z.boolean().optional(),
  deliveryNotes: z.string().max(300).optional(),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

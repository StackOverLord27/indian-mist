import { z } from "zod";

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);

export const AddressSchema = z.object({
  street: text(2, 200, "Street"),
  city: text(2, 80, "City"),
  state: text(2, 80, "State"),
  zipCode: z.string().trim().regex(/^[A-Za-z0-9 -]{4,10}$/, "Enter a valid PIN / ZIP code"),
  country: z.string().trim().max(60).optional(),
});

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,17}$/, "Enter a valid phone number");

export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        quantity: z.number().int().min(1).max(50),
        size: z.string().trim().max(40).optional(),
        color: z.string().trim().max(40).optional(),
      }),
    )
    .min(1, "Cart is empty")
    .max(50, "Too many items in the cart"),
  customerName: text(2, 80, "Name"),
  email: z.string().trim().email("Enter a valid email address").max(120),
  phone,
  shippingAddress: AddressSchema,
  saveAddress: z.boolean().optional(),
  promoCode: z.string().trim().max(40).optional(),
  deliveryNotes: z.string().trim().max(500, "Delivery notes are too long").optional(),
});

export const ProfileUpdateSchema = z
  .object({
    name: text(2, 80, "Name").optional(),
    phone: phone.optional().or(z.literal("")),
    shippingAddress: AddressSchema.optional(),
  })
  .strict();

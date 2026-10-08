import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Price must be a positive number"),
  originalPrice: z.number().optional(),
  description: z.string().min(1, "Description is required"),
  badge: z.enum(["New", "Sale", "Sold Out", ""]).optional(),
  tags: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  careInstructions: z.array(z.object({
    text: z.string(),
    icon: z.string(),
  })).optional(),
  shippingInfo: z.object({
    standard: z.string().optional(),
    express: z.string().optional(),
  }).optional(),
  isFeatured: z.boolean().optional().default(false),
  trackInventory: z.boolean().optional().default(false),
  stockQuantity: z.number().int().min(0).optional().default(0),
});

export const AnnouncementSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(200, "Text cannot exceed 200 characters"),
  link: z.string().optional(),
  linkText: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const CarouselSchema = z.object({
  alt: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const AboutSchema = z.object({
  mission: z
    .object({
      heading: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
  drivesUs: z
    .object({
      heading: z.string().optional(),
      cards: z
        .array(
          z.object({
            icon: z.string().optional(),
            title: z.string().optional(),
            body: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  cta: z
    .object({
      heading: z.string().optional(),
      subtext: z.string().optional(),
      primaryButtonLabel: z.string().optional(),
      primaryButtonLink: z.string().optional(),
      secondaryButtonLabel: z.string().optional(),
      secondaryButtonLink: z.string().optional(),
    })
    .optional(),
  customSections: z
    .array(
      z.object({
        _id: z.string().optional(),
        type: z.literal("image-text-split").default("image-text-split"),
        heading: z.string().optional(),
        body: z.string().optional(),
        imageUrl: z.string().optional(),
        imagePublicId: z.string().optional(),
        imageAlt: z.string().optional(),
        imageAlignment: z.enum(["left", "right"]).optional().default("left"),
        order: z.number().optional().default(0),
      }),
    )
    .optional(),
});

export const SettingsSchema = z.object({
  storeName: z.string().optional(),
  tagline: z.string().optional(),
  contactEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
  footerNote: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  heroSettings: z
    .object({
      subtitle: z.string().optional(),
      titleLine1: z.string().optional(),
      titleLine2: z.string().optional(),
      description: z.string().optional(),
      primaryButtonText: z.string().optional(),
      primaryButtonLink: z.string().optional(),
      secondaryButtonText: z.string().optional(),
      secondaryButtonLink: z.string().optional(),
      theme: z.enum(["forest", "midnight", "sunlit"]).optional(),
      ecoBadge: z
        .object({
          text: z.string().optional(),
          subtext: z.string().optional(),
          isVisible: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  // Pricing & shipping — stored as editable settings so admins can change rates
  // without a code deploy. Per-product GST is intentionally NOT supported here;
  // different HSN codes / product-level rates should be handled at invoice generation
  // time (e.g., via the order API), not at the checkout display level.
  pricingSettings: z
    .object({
      shippingCost: z.number().nonnegative().optional(),
      freeShippingThreshold: z.number().nonnegative().optional(),
      gstRate: z.number().min(0).max(100).optional(),
      showPricesInclusiveOfGst: z.boolean().optional(),
      promoCodes: z
        .array(
          z
            .object({
              _id: z.string().optional(),
              code: z.string().min(1, "Code is required"),
              discountType: z.enum(["PERCENTAGE", "FIXED"]),
              discountValue: z.number().min(0, "Discount value must be at least 0"),
              isActive: z.boolean().optional().default(true),
              minOrderValue: z.number().min(0).optional().default(0),
              maxUses: z.number().min(0).optional().default(0),
              maxUsesPerUser: z.number().min(0).optional().default(1),
              description: z.string().optional().default(""),
              expiresAt: z.string().nullable().optional().default(null),
              createdAt: z.string().optional(),
            })
            .refine(
              (data) => {
                if (data.discountType === "PERCENTAGE") {
                  return data.discountValue <= 100;
                }
                return true;
              },
              {
                message: "Percentage discount cannot exceed 100%",
                path: ["discountValue"],
              },
            ),
        )
        .optional(),
    })
    .optional(),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isFeatured: z.boolean().optional().default(false),
  isHidden: z.boolean().optional().default(false),
});
export const CollectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  order: z.number().optional().default(0),
  products: z.array(z.string()).optional(),
});

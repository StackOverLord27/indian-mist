import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);

export const ProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  category: z.string().min(1, "Category is required").max(120),
  price: z.number().positive("Price must be a positive number").max(10_000_000, "Price is too high"),
  originalPrice: z.number().positive("Original price must be positive").max(10_000_000).optional(),
  description: z.string().trim().min(1, "Description is required").max(20_000, "Description is too long"),
  badge: z.enum(["New", "Sale", "Sold Out", ""]).optional(),
  tags: z.array(shortText(60)).max(30).optional(),
  sizes: z.array(shortText(40)).max(20).optional(),
  features: z.array(shortText(500)).max(30).optional(),
  materials: z.array(shortText(200)).max(30).optional(),
  careInstructions: z.array(z.object({
    text: shortText(300),
    icon: shortText(40),
  })).max(30).optional(),
  shippingInfo: z.object({
    standard: shortText(100).optional(),
    express: shortText(100).optional(),
  }).optional(),
  colorName: z.string().trim().max(40).optional(),
  colorHex: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, "Colour must be a hex code like #1a2b3c").optional(),
  colorGroup: z.string().trim().max(80).optional(),
  isFeatured: z.boolean().optional().default(false),
  trackInventory: z.boolean().optional().default(false),
  stockQuantity: z.number().int().min(0).max(1_000_000).optional().default(0),
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
  alt: z.string().trim().max(300, "Alt text is too long").optional(),
  isActive: z.boolean().optional().default(true),
});

/** What an existing carousel item lets the admin change. Nothing else (url, publicId) is ever taken from the request. */
export const CarouselUpdateSchema = z.object({
  alt: z.string().trim().max(300, "Alt text is too long").optional(),
  altText: z.string().trim().max(300, "Alt text is too long").optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).max(100_000).optional(),
});

// Text limits are generous: they stop runaway input, not normal writing. Text is stored exactly
// as typed (not trimmed): headings such as "We make things the forest would " deliberately end
// with a space because the next line continues the sentence.
const text = (max: number) => z.string().max(max, "Too long");
const richText = z.string().max(100_000, "Too long");

// Image addresses must be web addresses (or empty); link targets may also be a site path.
export const imageUrl = z
  .string()
  .max(2000, "Too long")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must be a web address starting with https://");
export const linkTarget = z
  .string()
  .trim()
  .max(2000, "Too long")
  .refine(
    (v) => v === "" || /^(https?:\/\/|mailto:|tel:)/i.test(v) || (v.startsWith("/") && !v.startsWith("//")),
    "Must start with / or https://",
  );
const publicIdField = z.string().max(300, "Too long");

const AboutImageSchema = z.object({
  url: imageUrl.optional(),
  publicId: publicIdField.optional(),
  alt: text(300).optional(),
});

export const AboutSchema = z.object({
  hero: z
    .object({
      eyebrow: text(200).optional(),
      headline: text(500).optional(),
      lead: text(5000).optional(),
    })
    .optional(),
  story: z
    .object({
      eyebrow: text(200).optional(),
      heading: text(500).optional(),
      body: richText.optional(),
      image: AboutImageSchema.optional(),
    })
    .optional(),
  gallery: z
    .object({
      isVisible: z.boolean().optional(),
      eyebrow: text(200).optional(),
      heading: text(500).optional(),
      linkLabel: text(200).optional(),
      linkHref: linkTarget.optional(),
      images: z.array(AboutImageSchema).max(20).optional(),
    })
    .optional(),
  mission: z
    .object({
      heading: text(500).optional(),
      body: richText.optional(),
    })
    .optional(),
  drivesUs: z
    .object({
      heading: text(500).optional(),
      cards: z
        .array(
          z.object({
            icon: text(60).optional(),
            title: text(300).optional(),
            body: text(5000).optional(),
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),
  cta: z
    .object({
      heading: text(500).optional(),
      subtext: text(2000).optional(),
      primaryButtonLabel: text(100).optional(),
      primaryButtonLink: linkTarget.optional(),
      secondaryButtonLabel: text(100).optional(),
      secondaryButtonLink: linkTarget.optional(),
    })
    .optional(),
  // Legacy team photo (no longer editable in the admin, still shown if present)
  teamPhoto: AboutImageSchema.optional(),
  customSections: z
    .array(
      z.object({
        _id: z.string().max(40).optional(),
        type: z.literal("image-text-split").default("image-text-split"),
        heading: text(500).optional(),
        body: richText.optional(),
        imageUrl: imageUrl.optional(),
        imagePublicId: publicIdField.optional(),
        imageAlt: text(300).optional(),
        imageAlignment: z.enum(["left", "right"]).optional().default("left"),
        order: z.number().optional().default(0),
      }),
    )
    .max(20)
    .optional(),
});

// ─── Site settings ──────────────────────────────────────────────────────────
// One schema covers every section the admin settings pages save. The route saves ONLY the
// parsed result, so anything not listed here (including _id, timestamps, __v and sizeChart,
// which has its own upload endpoint) is dropped.

const webUrl = z
  .string()
  .trim()
  .max(2000, "Too long")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with https://");
const optionalEmail = z
  .string()
  .trim()
  .max(200, "Too long")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email address");
const money = (max: number) => z.number().finite().min(0, "Must be 0 or more").max(max, "Too high");

export const PromoCodeSchema = z
  .object({
    _id: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    // Codes are saved upper-case, because the shop compares them upper-cased
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,30}$/, "Use 2-30 letters, numbers, - or _"),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    discountValue: money(10_000_000),
    isActive: z.boolean().optional().default(true),
    minOrderValue: money(10_000_000).optional().default(0),
    maxUses: z.number().int().min(0).max(1_000_000).optional().default(0),
    maxUsesPerUser: z.number().int().min(0).max(1000).optional().default(1),
    description: text(300).optional().default(""),
    expiresAt: z
      .string()
      .max(40)
      .refine((v) => !Number.isNaN(Date.parse(v)), "Not a valid date")
      .nullable()
      .optional()
      .default(null),
    createdAt: z.string().max(40).optional(),
  })
  .refine((promo) => promo.discountType !== "PERCENTAGE" || promo.discountValue <= 100, {
    message: "Percentage discount cannot exceed 100%",
    path: ["discountValue"],
  });

export const SettingsSchema = z.object({
  // General
  tagline: text(200).optional(),
  contactEmail: optionalEmail.optional(),
  footerNote: text(1000).optional(),
  metaTitle: text(200).optional(),
  metaDescription: text(500).optional(),
  socialLinks: z
    .object({
      instagram: webUrl.optional(),
      facebook: webUrl.optional(),
      twitter: webUrl.optional(),
      youtube: webUrl.optional(),
    })
    .optional(),

  // Homepage
  heroSettings: z
    .object({
      subtitle: text(200).optional(),
      titleLine1: text(200).optional(),
      titleLine2: text(200).optional(),
      description: text(2000).optional(),
      primaryButtonText: text(100).optional(),
      primaryButtonLink: linkTarget.optional(),
      secondaryButtonText: text(100).optional(),
      secondaryButtonLink: linkTarget.optional(),
      theme: z.enum(["forest", "midnight", "sunlit"]).optional(),
      ecoBadge: z
        .object({
          text: text(50).optional(),
          subtext: text(100).optional(),
          isVisible: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  brandStorySettings: z
    .object({
      subtitle: text(200).optional(),
      titleLine1: text(200).optional(),
      titleLine2: text(200).optional(),
      description: text(5000).optional(),
      tags: text(500).optional(),
      buttonText: text(100).optional(),
      buttonLink: linkTarget.optional(),
      imageUrl: imageUrl.optional(),
      imagePublicId: publicIdField.optional(),
    })
    .optional(),
  trustStripSettings: z
    .object({
      items: z
        .array(z.object({ icon: text(60).optional(), title: text(100).optional(), subtitle: text(200).optional() }))
        .max(12)
        .optional(),
    })
    .optional(),
  ecoCommitmentSettings: z
    .object({
      subtitle: text(200).optional(),
      titleLine1: text(200).optional(),
      titleLine2: text(200).optional(),
      items: z
        .array(
          z.object({
            icon: text(60).optional(),
            number: text(30).optional(),
            label: text(100).optional(),
            description: text(500).optional(),
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),

  // Pricing & shipping. Per-product GST is intentionally NOT supported here: different HSN
  // codes / product-level rates belong at invoice generation time, not the checkout display.
  pricingSettings: z
    .object({
      shippingCost: money(100_000).optional(),
      freeShippingThreshold: money(10_000_000).optional(),
      gstRate: z.number().finite().min(0).max(100).optional(),
      showPricesInclusiveOfGst: z.boolean().optional(),
      promoCodes: z
        .array(PromoCodeSchema)
        .max(100)
        .superRefine((promos, ctx) => {
          const seen = new Set<string>();
          promos.forEach((promo, index) => {
            if (seen.has(promo.code)) {
              ctx.addIssue({ code: "custom", message: `Promo code ${promo.code} is listed twice`, path: [index, "code"] });
            }
            seen.add(promo.code);
          });
        })
        .optional(),
    })
    .optional(),

  // Contact page
  contactPageSettings: z
    .object({
      title: text(200).optional(),
      subtitle: text(2000).optional(),
      address: text(500).optional(),
      phone: text(40).optional(),
      whatsapp: text(40).optional(),
      email: optionalEmail.optional(),
      businessHours: text(200).optional(),
      faqs: z
        .array(
          z.object({
            question: text(300).refine((v) => v.trim() !== "", "Question is required"),
            answer: text(5000).refine((v) => v.trim() !== "", "Answer is required"),
          }),
        )
        .max(30)
        .optional(),
    })
    .optional(),
});

export type ParsedSettings = z.infer<typeof SettingsSchema>;

export const CategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().trim().max(2000, "Description is too long").optional(),
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

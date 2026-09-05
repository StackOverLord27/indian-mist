import { z } from 'zod';

export const ProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.number().positive('Price must be a positive number'),
  originalPrice: z.number().optional(),
  description: z.string().min(1, 'Description is required'),
  badge: z.enum(['New', 'Sale', 'Sold Out', '']).optional(),
  tags: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
});

export const AnnouncementSchema = z.object({
  text: z.string().min(1, 'Text is required').max(200, 'Text cannot exceed 200 characters'),
  link: z.string().optional(),
  linkText: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const CarouselSchema = z.object({
  alt: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const AboutSchema = z.object({
  mission: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
  }).optional(),
  drivesUs: z.object({
    heading: z.string().optional(),
    cards: z.array(z.object({
      icon: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
    })).optional(),
  }).optional(),
  cta: z.object({
    heading: z.string().optional(),
    subtext: z.string().optional(),
    primaryButtonLabel: z.string().optional(),
    secondaryButtonLabel: z.string().optional(),
  }).optional(),
});

export const SettingsSchema = z.object({
  storeName: z.string().optional(),
  tagline: z.string().optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  socialLinks: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
  }).optional(),
  footerNote: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  heroSettings: z.object({
    subtitle: z.string().optional(),
    titleLine1: z.string().optional(),
    titleLine2: z.string().optional(),
    description: z.string().optional(),
    primaryButtonText: z.string().optional(),
    primaryButtonLink: z.string().optional(),
    secondaryButtonText: z.string().optional(),
    secondaryButtonLink: z.string().optional(),
    ecoBadge: z.object({
      text: z.string().optional(),
      subtext: z.string().optional(),
      isVisible: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isFeatured: z.boolean().optional().default(false),
  isHidden: z.boolean().optional().default(false),
});

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
  isPrimary: boolean;
  isCategoryCover?: boolean;
}

export interface Material {
  name: string;
  percentage: number;
  origin: string;
}

export interface AdminProduct {
  _id: string; // Mongo ID
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  sizes?: string[];
  tags: string[];
  badge?: 'New' | 'Sale' | '';
  materials: Material[];
  images: ProductImage[];
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface Announcement {
  _id: string;
  text: string;
  linkUrl?: string;
  linkText?: string;
  isActive: boolean;
  order: number;
}

export interface CarouselImage {
  _id: string;
  url: string;
  publicId: string;
  alt?: string;
  altText?: string;
  order: number;
  isActive: boolean;
}

export interface AboutContent {
  mission: {
    heading: string;
    body: string;
  };
  drivesUs: {
    heading: string;
    cards: Array<{
      icon: string;
      title: string;
      body: string;
    }>;
  };
  cta: {
    heading: string;
    subtext: string;
    primaryButtonLabel: string;
    primaryButtonLink?: string;
    secondaryButtonLabel: string;
    secondaryButtonLink?: string;
  };
  customSections?: {
    _id?: string;
    type: 'image-text-split';
    heading: string;
    body: string;
    imageUrl: string;
    imagePublicId: string;
    imageAlt: string;
    imageAlignment: 'left' | 'right';
    order: number;
  }[];
}

export interface HeroSettings {
  subtitle?: string;
  titleLine1?: string;
  titleLine2?: string;
  description?: string;
  primaryButtonText?: string;
  primaryButtonLink?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  theme?: 'forest' | 'midnight' | 'sunlit';
  ecoBadge?: {
    text?: string;
    subtext?: string;
    isVisible?: boolean;
  };
}

export interface BrandStorySettings {
  subtitle?: string;
  titleLine1?: string;
  titleLine2?: string;
  description?: string;
  tags?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: string;
}

export interface PricingSettings {
  /** Flat shipping fee in INR when order is below threshold */
  shippingCost?: number;
  /** Order value above which shipping is free (in INR) */
  freeShippingThreshold?: number;
  /** GST rate as a percentage, e.g. 18 means 18% */
  gstRate?: number;
  /** When true, displayed prices are GST-inclusive */
  showPricesInclusiveOfGst?: boolean;
}

export interface SiteSettings {
  _id?: string;
  tagline?: string;
  contactEmail?: string;
  footerNote?: string;
  metaTitle?: string;
  metaDescription?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
  };
  heroSettings?: HeroSettings;
  brandStorySettings?: BrandStorySettings;
  trustStripSettings?: {
    items: {
      icon: string;
      title: string;
      subtitle: string;
    }[];
  };
  ecoCommitmentSettings?: {
    subtitle: string;
    titleLine1: string;
    titleLine2: string;
    items: {
      icon: string;
      number: string;
      label: string;
      description: string;
    }[];
  };
  pricingSettings?: PricingSettings;
}

export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: { url: string; publicId: string; alt: string };
  isFeatured: boolean;
  isHidden?: boolean;
}

export interface AdminCollection {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  products: string[] | AdminProduct[];
  isActive: boolean;
  order: number;
}

export interface AdminBlog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: {
    url: string;
    publicId: string;
    alt: string;
  };
  category: string;
  tags: string[];
  author: string;
  isPublished: boolean;
  publishedAt?: string;
  readTime: number;
  createdAt: string;
  updatedAt: string;
}

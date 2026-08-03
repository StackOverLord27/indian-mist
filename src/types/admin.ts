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
  altText: string;
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
    secondaryButtonLabel: string;
  };
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  contactEmail: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
  };
  footerNote: string;
  metaTitle: string;
  metaDescription: string;
}

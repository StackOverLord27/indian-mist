export type HomeImage = {
  src?: string;
  alt: string;
  fallbackClassName: string;
};

export type ProductBadge = "New" | "Sale" | "Sold Out";

export type Product = {
  id: string;
  /** The product's database id: what the bag and wishlist use to identify it (id above is the URL slug) */
  productId?: string;
  name: string;
  category: string;
  price: string;
  badge?: ProductBadge;
  image: HomeImage;
  sizes?: string[];
};

export type Category = {
  id: string;
  name: string;
  productCount: string;
  featured?: boolean;
  image: HomeImage;
};

export type Arrival = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  badge?: ProductBadge;
  image: HomeImage;
  sizes?: string[];
};

export const heroImage: HomeImage = {
  alt: "Indian Mist",
  fallbackClassName: "bg-olive-leaf",
};

export const storyImage: HomeImage = {
  alt: "Indian Mist Story",
  fallbackClassName: "bg-black-forest",
};

export const featuredProducts: Product[] = [];
export const categories: Category[] = [];
export const newestArrivals: Arrival[] = [];


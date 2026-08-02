export type HomeImage = {
  src?: string;
  alt: string;
  fallbackClassName: string;
};

export type ProductBadge = "New" | "Sale" | "Sold Out";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  badge?: ProductBadge;
  image: HomeImage;
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
};

export const heroImage: HomeImage = {
  src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
  alt: "Forest trail with warm morning light",
  fallbackClassName: "bg-olive-leaf",
};

export const storyImage: HomeImage = {
  src: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1400&auto=format&fit=crop",
  alt: "Dense evergreen forest canopy",
  fallbackClassName: "bg-black-forest",
};

export const featuredProducts: Product[] = [
  {
    id: "trailpack-canvas",
    name: "Trailpack Canvas 22L",
    category: "Forest gear",
    price: "₹2,499",
    badge: "New",
    image: {
      src: "https://images.unsplash.com/photo-1622260614153-03223fb72052?q=80&w=1000&auto=format&fit=crop",
      alt: "Canvas backpack for forest trails",
      fallbackClassName: "bg-olive-leaf/20",
    },
  },
  {
    id: "organic-field-tee",
    name: "Organic Field Tee",
    category: "Apparel",
    price: "₹899",
    badge: "Sold Out",
    image: {
      src: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1000&auto=format&fit=crop",
      alt: "Organic cotton outdoor shirt",
      fallbackClassName: "bg-warm-mist",
    },
  },
  {
    id: "copper-leaf-pin",
    name: "Copper Leaf Pin Set",
    category: "Pins",
    price: "₹349",
    badge: "New",
    image: {
      src: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1000&auto=format&fit=crop",
      alt: "Copper leaf pins on a natural surface",
      fallbackClassName: "bg-copperwood/20",
    },
  },
  {
    id: "recycled-journal",
    name: "Recycled Trail Journal",
    category: "Stationery",
    price: "₹599",
    image: {
      src: "https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1000&auto=format&fit=crop",
      alt: "Recycled paper journal for trail notes",
      fallbackClassName: "bg-sunlit-clay/20",
    },
  },
];

export const categories: Category[] = [
  {
    id: "forest-gear-packs",
    name: "Forest gear & packs",
    productCount: "32 products",
    featured: true,
    image: {
      src: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=1400&auto=format&fit=crop",
      alt: "Backpack and camping gear in a forest clearing",
      fallbackClassName: "bg-black-forest",
    },
  },
  {
    id: "apparel",
    name: "Apparel",
    productCount: "18 products",
    image: {
      src: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=1000&auto=format&fit=crop",
      alt: "Neutral outdoor apparel on hangers",
      fallbackClassName: "bg-olive-leaf/25",
    },
  },
  {
    id: "keychains-pins",
    name: "Keychains & pins",
    productCount: "14 products",
    image: {
      src: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1000&auto=format&fit=crop",
      alt: "Small metal pins and keychain details",
      fallbackClassName: "bg-copperwood/25",
    },
  },
  {
    id: "stationery",
    name: "Stationery",
    productCount: "11 products",
    image: {
      src: "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1000&auto=format&fit=crop",
      alt: "Notebook and pencil on a wooden desk",
      fallbackClassName: "bg-sunlit-clay/25",
    },
  },
];

export const newestArrivals: Arrival[] = [
  {
    id: "mist-shell-jacket",
    name: "Mist Shell Jacket",
    category: "Apparel",
    description: "A light recycled shell made for sudden rain and humid forest walks.",
    price: "₹3,299",
    image: {
      src: "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=1200&auto=format&fit=crop",
      alt: "Light outdoor jacket in earthy green",
      fallbackClassName: "bg-olive-leaf/25",
    },
  },
  {
    id: "rootline-daypack",
    name: "Rootline Daypack",
    category: "Forest gear",
    description: "Compact storage, plant-dyed canvas, and hardware built to repair.",
    price: "₹2,799",
    image: {
      src: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1200&auto=format&fit=crop",
      alt: "Canvas daypack ready for travel",
      fallbackClassName: "bg-black-forest/25",
    },
  },
  {
    id: "seed-paper-postcards",
    name: "Seed Paper Postcards",
    category: "Stationery",
    description: "Write, send, plant, and grow native flowering seeds after use.",
    price: "₹449",
    image: {
      src: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=1200&auto=format&fit=crop",
      alt: "Eco stationery cards on a desk",
      fallbackClassName: "bg-warm-mist",
    },
  },
];

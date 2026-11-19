// Shapes returned by the products list aggregation (items plus filter counts)
export type ProductFacetItem = {
  _id?: { toString(): string };
  slug?: string;
  name?: string;
  category?: string;
  price?: number;
  images?: (string | { url?: string })[];
  badge?: "New" | "Sale" | "Sold Out" | "";
  sizes?: string[];
};

export const imageUrls = (images: ProductFacetItem["images"]): string[] =>
  (images ?? [])
    .map((img) => (typeof img === "string" ? img : img?.url))
    .filter((url): url is string => Boolean(url));

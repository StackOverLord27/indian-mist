import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { WishlistPageClient } from "@/components/wishlist/WishlistPageClient";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: NOINDEX,
  description: "Your saved products from Indian Mist.",
};

export default function WishlistPage() {
  return <WishlistPageClient />;
}

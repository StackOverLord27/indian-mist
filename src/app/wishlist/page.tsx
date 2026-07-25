import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/wishlist/WishlistPageClient";

export const metadata: Metadata = {
  title: "Wishlist | Indian Mist",
  description: "Your saved products from Indian Mist.",
};

export default function WishlistPage() {
  return <WishlistPageClient />;
}

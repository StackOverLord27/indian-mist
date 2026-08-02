import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Your Bag | Indian Mist",
  description: "Review the items in your bag before checkout.",
};

export default function CartPage() {
  return <CartPageClient />;
}

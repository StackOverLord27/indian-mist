import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Your Cart | Indian Mist",
  description: "Review the items in your cart before checkout.",
};

export default function CartPage() {
  return <CartPageClient />;
}

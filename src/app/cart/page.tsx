import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Your Bag",
  robots: NOINDEX,
  description: "Review the items in your bag before checkout.",
};

export default function CartPage() {
  return <CartPageClient />;
}

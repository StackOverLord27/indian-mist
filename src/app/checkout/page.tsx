import type { Metadata } from "next";
import { CheckoutPageClient } from "@/components/checkout/CheckoutPageClient";

export const metadata: Metadata = {
  title: "Checkout | Indian Mist",
  description: "Complete your purchase securely with Indian Mist.",
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
